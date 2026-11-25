
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const {
  sequelize,
  Email,
  Prospect,
  Interaction
} = require('../models');

let syncing = false;

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

async function getProspectsByEmail() {

  const prospects = await Prospect.findAll();
  const map = new Map();

  for (const prospect of prospects) {

    const address = prospect.email
      ?.trim()
      .toLowerCase();

    if (!address) continue;

    if (!map.has(address)) {
      map.set(address, []);
    }

    map.get(address).push(prospect);

  }

  return map;
}

function findMatchingProspect(addresses, prospectsByEmail) {

  const matches = new Map();

  for (const address of addresses) {

    const normalized = address
      ?.trim()
      .toLowerCase();

    if (!normalized) continue;

    const prospects =
      prospectsByEmail.get(normalized) || [];

    for (const prospect of prospects) {

      matches.set(prospect.id, prospect);

    }
  }

  return matches.size === 1
    ? [...matches.values()][0]
    : null;
}

async function syncFolder(
  client,
  remoteFolder,
  localFolder,
  prospectsByEmail
) {

  const stats = {
    scanned: 0,
    imported: 0,
    updated: 0,
    linked: 0
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

    // Les 100 derniers messages du dossier.
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

      if (existing) {

        if (existing.isRead !== isRead) {

          await existing.update({ isRead });
          stats.updated++;

        }

        continue;
      }

      const parsed = await simpleParser(
        message.source
      );

      const sender = parsed.from?.value?.[0];

      const fromEmail = sender?.address
        ?.trim()
        .toLowerCase() || '';

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

      const matchingAddresses =
        localFolder === 'SENT'
          ? recipientAddresses
          : [fromEmail];

      const prospect = findMatchingProspect(
        matchingAddresses,
        prospectsByEmail
      );

      const subject =
        parsed.subject || '(Sans objet)';

      const content = parsed.text || '';

      const receivedAt = message.internalDate
        || parsed.date
        || new Date();

      await sequelize.transaction(async transaction => {

        await Email.create({

          uid: message.uid,
          uidValidity,
          messageId: parsed.messageId || null,

          folder: localFolder,

          fromName: sender?.name || '',
          fromEmail,
          toEmail,

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

          prospectId: prospect?.id || null

        }, { transaction });

        // Les messages reçus alimentent
        // automatiquement l'historique commercial.
        if (prospect && localFolder === 'INBOX') {

          await Interaction.create({

            prospectId: prospect.id,
            type: 'email_received',
            subject,
            content,
            occurredAt: receivedAt

          }, { transaction });

        }

      });

      stats.imported++;

      if (prospect) {
        stats.linked++;
      }

    }

    return stats;

  } finally {

    lock.release();

  }
}

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
    folders: {},
    warnings: []
  };

  try {

    client = createClient();

    await client.connect();

    const folders = await client.list();

    const sentFolder = folders.find(folder =>
      folder.specialUse === '\\Sent'
    ) || folders.find(folder =>
      ['sent', 'sent items', 'sent messages', 'envoyés']
        .includes(folder.name?.toLowerCase())
    );

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

    const prospectsByEmail =
      await getProspectsByEmail();

    for (const target of targets) {

      const result = await syncFolder(
        client,
        target.remote,
        target.local,
        prospectsByEmail
      );

      stats.folders[target.local] = result;

      stats.scanned += result.scanned;
      stats.imported += result.imported;
      stats.updated += result.updated;
      stats.linked += result.linked;

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

// Compatibilité avec le contrôleur existant.
async function syncInbox() {
  return syncAll();
}

module.exports = {
  verifyConnection,
  listFolders,
  syncInbox,
  syncAll
};
