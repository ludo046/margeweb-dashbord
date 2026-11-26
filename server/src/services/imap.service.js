const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const {
  sequelize,
  Email,
  Prospect,
  Client,
  Interaction
} = require('../models');

let syncing = false;

// ==========================================
// CONNEXION IMAP
// ==========================================

function createClient() {

  if (!process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {

    const error = new Error(
      'Messagerie IMAP non configurée.'
    );

    error.status = 503;
    throw error;

  }

  return new ImapFlow({

    host: process.env.IMAP_HOST || 'imap.hostinger.com',
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE !== 'false',

    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD
    },

    logger: false,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 60000

  });

}

async function verifyConnection() {

  const client = createClient();

  try {

    await client.connect();

    return true;

  } finally {

    client.close();

  }

}

async function listFolders() {

  const client = createClient();

  try {

    await client.connect();

    const folders = await client.list();

    return folders.map(folder => ({
      name: folder.name,
      path: folder.path,
      specialUse: folder.specialUse || null
    }));

  } finally {

    client.close();

  }

}

// ==========================================
// RECHERCHE DU DOSSIER ENVOYÉS
// ==========================================

function findSentFolder(folders) {

  return folders.find(folder =>

    folder.specialUse === '\\Sent'

  ) || folders.find(folder =>

    [
      'sent',
      'sent items',
      'sent messages',
      'envoyés',
      'messages envoyés'
    ].includes(folder.name?.toLowerCase())

  ) || null;

}

// ==========================================
// ENREGISTREMENT DANS ENVOYÉS
// ==========================================

async function appendSentMessage(raw) {

  if (!Buffer.isBuffer(raw) || !raw.length) {

    throw new Error(
      'Le message MIME est invalide.'
    );

  }

  const client = createClient();

  try {

    await client.connect();

    const folders = await client.list();

    const sentFolder = findSentFolder(folders);

    if (!sentFolder) {

      throw new Error(
        'Dossier des messages envoyés introuvable.'
      );

    }

    // Ajouter une copie du message original
    // dans le dossier Envoyés de Hostinger

    const result = await client.append(

      sentFolder.path,

      raw,

      ['\\Seen'],

      new Date()

    );

    if (!result) {

      throw new Error(
        'Enregistrement IMAP non confirmé.'
      );

    }

    return {

      success: true,

      folder: sentFolder.path

    };

  } finally {

    client.close();

  }

}

// ==========================================
// RECONNAISSANCE DES CONTACTS
// ==========================================

function normalizeEmail(address) {

  return String(address || '')
    .trim()
    .toLowerCase();

}

async function getContactsByEmail() {

  const [prospects, clients] = await Promise.all([
    Prospect.findAll(),
    Client.findAll()
  ]);

  const map = new Map();

  const clientsByProspect = new Map();

  for (const client of clients) {

    if (client.prospectId != null) {

      clientsByProspect.set(
        client.prospectId,
        client
      );

    }

  }

  function addContact(address, contact) {

    const normalized = normalizeEmail(address);

    if (!normalized) return;

    if (!map.has(normalized)) {

      map.set(normalized, new Map());

    }

    const key = contact.clientId != null
      ? `client:${contact.clientId}`
      : `prospect:${contact.prospectId}`;

    map.get(normalized).set(key, contact);

  }

  // Ajouter les prospects

  for (const prospect of prospects) {

    const linkedClient =
      clientsByProspect.get(prospect.id);

    addContact(prospect.email, {

      prospectId: prospect.id,
      clientId: linkedClient?.id ?? null

    });

  }

  // Ajouter les clients

  for (const client of clients) {

    addContact(client.email, {

      prospectId: client.prospectId ?? null,
      clientId: client.id

    });

  }

  return map;

}

function findMatchingContact(addresses, contactsByEmail) {

  const matches = new Map();

  const ownAddresses = new Set([
    normalizeEmail(process.env.IMAP_USER),
    normalizeEmail(process.env.SMTP_USER)
  ]);

  for (const address of addresses) {

    const normalized = normalizeEmail(address);

    if (!normalized || ownAddresses.has(normalized)) {
      continue;
    }

    const contacts = contactsByEmail.get(normalized);

    if (!contacts) continue;

    for (const [key, contact] of contacts) {

      matches.set(key, contact);

    }

  }

  return matches.size === 1
    ? [...matches.values()][0]
    : null;

}

// ==========================================
// ANALYSE DES MESSAGES
// ==========================================

function getMessageAddresses(parsed, localFolder) {

  const sender = parsed.from?.value?.[0];

  const fromEmail = normalizeEmail(
    sender?.address
  );

  const recipients = Array.isArray(parsed.to)
    ? parsed.to
    : parsed.to
      ? [parsed.to]
      : [];

  const recipientAddresses = recipients
    .flatMap(recipient => recipient.value || [])
    .map(recipient => recipient.address)
    .filter(Boolean);

  const toEmail = recipients
    .map(recipient => recipient.text || '')
    .join(', ');

  return {

    sender,
    fromEmail,
    toEmail,

    matchingAddresses:
      localFolder === 'SENT'
        ? recipientAddresses
        : [fromEmail]

  };

}

// ==========================================
// SYNCHRONISATION D'UN DOSSIER
// ==========================================

async function syncFolder(
  client,
  remoteFolder,
  localFolder,
  contactsByEmail
) {

  const stats = {
    scanned: 0,
    imported: 0,
    updated: 0,
    linked: 0,
    linkedClients: 0,
    linkedProspects: 0
  };

  const lock = await client.getMailboxLock(
    remoteFolder,
    { readOnly: true }
  );

  try {

    const uidValidity = String(
      client.mailbox.uidValidity
    );

    if (!client.mailbox.exists) {
      return stats;
    }

    // Les 100 derniers messages du dossier

    const first = Math.max(
      1,
      client.mailbox.exists - 99
    );

    const range = `${first}:*`;

    for await (const message of client.fetch(range, {

      uid: true,
      flags: true,
      source: true,
      internalDate: true

    })) {

      stats.scanned++;

      const isRead = localFolder === 'SENT'
        || message.flags?.has('\\Seen')
        || false;

      const existing = await Email.findOne({

        where: {
          folder: localFolder,
          uidValidity,
          uid: message.uid
        }

      });

      // ====================================
      // MESSAGE DÉJÀ IMPORTÉ
      // ====================================

      if (existing) {

        const changes = {};

        if (existing.isRead !== isRead) {

          changes.isRead = isRead;

        }

        let newlyLinked = null;

        // Ne jamais écraser une association existante

        if (
          existing.prospectId == null &&
          existing.clientId == null
        ) {

          const parsed = await simpleParser(
            message.source
          );

          const addresses = getMessageAddresses(
            parsed,
            localFolder
          );

          newlyLinked = findMatchingContact(
            addresses.matchingAddresses,
            contactsByEmail
          );

          if (newlyLinked) {

            changes.prospectId =
              newlyLinked.prospectId;

            changes.clientId =
              newlyLinked.clientId;

          }

        }

        if (Object.keys(changes).length > 0) {

          await sequelize.transaction(
            async transaction => {

              await existing.update(
                changes,
                { transaction }
              );

              // Créer l'interaction uniquement
              // pour un message reçu auparavant
              // sans association

              if (
                newlyLinked &&
                localFolder === 'INBOX'
              ) {

                await Interaction.create({

                  prospectId: newlyLinked.prospectId,
                  clientId: newlyLinked.clientId,

                  type: 'email_received',

                  subject:
                    existing.subject || '(Sans objet)',

                  content:
                    existing.textContent || '',

                  occurredAt:
                    existing.receivedAt

                }, { transaction });

              }

            }
          );

          stats.updated++;

          if (newlyLinked) {

            stats.linked++;

            if (newlyLinked.clientId != null) {

              stats.linkedClients++;

            } else {

              stats.linkedProspects++;

            }

          }

        }

        continue;

      }

      // ====================================
      // NOUVEAU MESSAGE
      // ====================================

      const parsed = await simpleParser(
        message.source
      );

      const addresses = getMessageAddresses(
        parsed,
        localFolder
      );

      const contact = findMatchingContact(
        addresses.matchingAddresses,
        contactsByEmail
      );

      const subject =
        parsed.subject || '(Sans objet)';

      const content =
        parsed.text || '';

      const receivedAt = message.internalDate
        || parsed.date
        || new Date();

      await sequelize.transaction(
        async transaction => {

          await Email.create({

            uid: message.uid,
            uidValidity,
            messageId: parsed.messageId || null,

            folder: localFolder,

            fromName:
              addresses.sender?.name || '',

            fromEmail:
              addresses.fromEmail,

            toEmail:
              addresses.toEmail,

            subject,
            textContent: content,

            htmlContent:
              typeof parsed.html === 'string'
                ? parsed.html
                : '',

            receivedAt,
            isRead,

            hasAttachments:
              (parsed.attachments?.length || 0) > 0,

            prospectId:
              contact?.prospectId ?? null,

            clientId:
              contact?.clientId ?? null

          }, { transaction });

          // Historique des messages reçus
          // Les messages envoyés sont déjà enregistrés
          // par le contrôleur d'envoi.

          if (contact && localFolder === 'INBOX') {

            await Interaction.create({

              prospectId: contact.prospectId,
              clientId: contact.clientId,

              type: 'email_received',

              subject,
              content,

              occurredAt: receivedAt

            }, { transaction });

          }

        }
      );

      stats.imported++;

      if (contact) {

        stats.linked++;

        if (contact.clientId != null) {

          stats.linkedClients++;

        } else {

          stats.linkedProspects++;

        }

      }

    }

    return stats;

  } finally {

    lock.release();

  }

}

// ==========================================
// SYNCHRONISATION GLOBALE
// ==========================================

async function syncAll() {

  if (syncing) {

    const error = new Error(
      'Synchronisation déjà en cours.'
    );

    error.status = 409;
    throw error;

  }

  syncing = true;

  let client;

  const stats = {

    scanned: 0,
    imported: 0,
    updated: 0,
    linked: 0,

    linkedClients: 0,
    linkedProspects: 0,

    folders: {},
    warnings: []

  };

  try {

    client = createClient();

    await client.connect();

    const folders = await client.list();

    const sentFolder = findSentFolder(folders);

    const targets = [

      {
        remote: 'INBOX',
        local: 'INBOX'
      }

    ];

    if (sentFolder) {

      targets.push({

        remote: sentFolder.path,
        local: 'SENT'

      });

    } else {

      stats.warnings.push(
        'Dossier des messages envoyés introuvable.'
      );

    }

    const contactsByEmail =
      await getContactsByEmail();

    for (const target of targets) {

      const result = await syncFolder(

        client,
        target.remote,
        target.local,
        contactsByEmail

      );

      stats.folders[target.local] = result;

      stats.scanned += result.scanned;
      stats.imported += result.imported;
      stats.updated += result.updated;
      stats.linked += result.linked;

      stats.linkedClients += result.linkedClients;

      stats.linkedProspects += result.linkedProspects;

    }

    return stats;

  } finally {

    try {

      if (client) {
        client.close();
      }

    } finally {

      syncing = false;

    }

  }

}

// Compatibilité avec le contrôleur existant

async function syncInbox() {

  return syncAll();

}

module.exports = {

  verifyConnection,
  listFolders,
  appendSentMessage,
  syncInbox,
  syncAll

};