
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { sequelize, Email, Prospect, Interaction } = require('../models');

let syncing = false;

function createClient() {
  if (!process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
    const error = new Error('Messagerie IMAP non configurée.');
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

async function syncInbox() {

  if (syncing) {
    const error = new Error('Synchronisation déjà en cours.');
    error.status = 409;
    throw error;
  }

  syncing = true;

  let client;
  let lock;

  const stats = {
    scanned: 0,
    imported: 0,
    updated: 0,
    linked: 0
  };

  try {

    client = createClient();

    await client.connect();

    lock = await client.getMailboxLock('INBOX');

    const uidValidity = String(client.mailbox.uidValidity);

    if (!client.mailbox.exists) {
      return stats;
    }

    const prospects = await Prospect.findAll();

    const prospectsByEmail = new Map();

    for (const prospect of prospects) {
      const address = prospect.email?.trim().toLowerCase();

      if (address) {
        if (!prospectsByEmail.has(address)) {
          prospectsByEmail.set(address, []);
        }

        prospectsByEmail.get(address).push(prospect);
      }
    }

    // Première version : les 100 derniers messages
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

      const isRead = message.flags?.has('\\Seen') || false;

      const existing = await Email.findOne({
        where: {
          folder: 'INBOX',
          uidValidity,
          uid: message.uid
        }
      });

      if (existing) {

        await existing.update({ isRead });

        stats.updated++;
        continue;
      }

      const parsed = await simpleParser(message.source);

      const sender = parsed.from?.value?.[0];

      const fromEmail = sender?.address
        ?.trim()
        .toLowerCase() || '';

      const matches = prospectsByEmail.get(fromEmail) || [];

      const prospect = matches.length === 1
        ? matches[0]
        : null;

      await sequelize.transaction(async transaction => {

        await Email.create({
          uid: message.uid,
          uidValidity,
          messageId: parsed.messageId || null,
          folder: 'INBOX',

          fromName: sender?.name || '',
          fromEmail,

          toEmail: parsed.to?.text || '',

          subject: parsed.subject || '(Sans objet)',

          textContent: parsed.text || '',

          htmlContent: typeof parsed.html === 'string'
            ? parsed.html
            : '',

          receivedAt: message.internalDate
            || parsed.date
            || new Date(),

          isRead,

          hasAttachments:
            (parsed.attachments?.length || 0) > 0,

          prospectId: prospect?.id || null

        }, { transaction });

        if (prospect) {

          await Interaction.create({
            prospectId: prospect.id,
            type: 'email_received',
            subject: parsed.subject || '(Sans objet)',
            content: parsed.text || '',
            occurredAt: message.internalDate
              || parsed.date
              || new Date()

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

    try {
      if (lock) {
        lock.release();
      }

      if (client) {
        client.close();
      }
    } finally {
      syncing = false;
    }

  }
}

module.exports = {
  verifyConnection,
  syncInbox
};
