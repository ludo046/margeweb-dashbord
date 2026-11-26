const {
  sequelize,
  Prospect,
  Client,
  Interaction,
  Email
} = require('../models');

const mailService = require('../services/mail.service');
const imapService = require('../services/imap.service');

// ==========================================
// VALIDATION
// ==========================================

function normalizeEmail(email) {

  return typeof email === 'string'
    ? email.trim().toLowerCase()
    : '';

}

function isValidEmail(email) {

  return typeof email === 'string' &&
    /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email);

}

function isValidContent(subject, content) {

  return (

    typeof subject === 'string' &&
    typeof content === 'string' &&
    subject.trim().length > 0 &&
    content.trim().length > 0 &&
    subject.length <= 255 &&
    !/[\r\n]/.test(subject)

  );

}

// ==========================================
// RECHERCHE DES CORRESPONDANTS
// ==========================================

async function findContactByEmail(email) {

  const address = normalizeEmail(email);

  if (!address) return null;

  const ownAddresses = new Set([
    normalizeEmail(process.env.SMTP_USER),
    normalizeEmail(process.env.IMAP_USER)
  ]);

  if (ownAddresses.has(address)) {
    return null;
  }

  const [prospects, clients] = await Promise.all([

    Prospect.findAll(),
    Client.findAll()

  ]);

  const clientsByProspect = new Map();

  for (const client of clients) {

    if (client.prospectId != null) {

      clientsByProspect.set(

        client.prospectId,
        client

      );

    }

  }

  const matches = new Map();

  // Rechercher parmi les prospects

  for (const prospect of prospects) {

    if (normalizeEmail(prospect.email) !== address) {

      continue;

    }

    const linkedClient =
      clientsByProspect.get(prospect.id);

    if (linkedClient) {

      matches.set(`client:${linkedClient.id}`, {

        prospectId: prospect.id,
        clientId: linkedClient.id

      });

    } else {

      matches.set(`prospect:${prospect.id}`, {

        prospectId: prospect.id,
        clientId: null

      });

    }

  }

  // Rechercher parmi les clients

  for (const client of clients) {

    if (normalizeEmail(client.email) !== address) {

      continue;

    }

    matches.set(`client:${client.id}`, {

      prospectId: client.prospectId ?? null,
      clientId: client.id

    });

  }

  // Ne pas rattacher un message ambigu

  return matches.size === 1

    ? [...matches.values()][0]

    : null;

}

// ==========================================
// ENVOI, HISTORIQUE ET COPIE IMAP
// ==========================================

async function sendAndRecord({

  recipient,
  subject,
  content,
  contact,
  originalEmail,
  res

}) {

  if (!isValidEmail(recipient)) {

    return res.status(400).json({

      message: 'Adresse e-mail invalide.'

    });

  }

  if (!isValidContent(subject, content)) {

    return res.status(400).json({

      message: 'Le sujet ou le contenu est invalide.'

    });

  }

  const messageId = originalEmail?.messageId;

  const validMessageId =

    typeof messageId === 'string' &&

    /^<[^<>\s]+>$/.test(messageId);

  // ========================================
  // 1. ENVOI SMTP
  // ========================================

  const result = await mailService.sendMail({

    to: recipient,

    subject: subject.trim(),

    text: content.trim(),

    inReplyTo: validMessageId
      ? messageId
      : undefined,

    references: validMessageId
      ? [messageId]
      : undefined

  });

  if (!result.accepted?.length) {

    return res.status(502).json({

      message: 'Le serveur SMTP a refusé le destinataire.'

    });

  }

  // À partir de ce point, le message a été
  // accepté par le serveur SMTP.
  //
  // Une erreur ultérieure ne doit jamais
  // provoquer un nouvel envoi.

  let interaction = null;

  let sentSaved = false;

  const warnings = [];

  // ========================================
  // 2. HISTORIQUE COMMERCIAL
  // ========================================

  try {

    if (contact) {

      interaction = await sequelize.transaction(

        async transaction => {

          let prospectId =
            contact.prospectId ?? null;

          let clientId =
            contact.clientId ?? null;

          // Vérifier si le prospect a été converti
          // pendant l'envoi du message.

          if (prospectId != null && clientId == null) {

            const linkedClient = await Client.findOne({

              where: {
                prospectId
              },

              transaction

            });

            if (linkedClient) {

              clientId = linkedClient.id;

            }

          }

          return Interaction.create({

            prospectId,
            clientId,

            type: 'email_sent',

            subject: subject.trim(),

            content: content.trim(),

            occurredAt: new Date()

          }, { transaction });

        }

      );

    }

  } catch (historyError) {

    console.error(

      'Erreur d’enregistrement de l’historique :',

      historyError

    );

    warnings.push(

      'L’historique commercial n’a pas pu être enregistré.'

    );

  }

  // ========================================
  // 3. ENREGISTREMENT DANS ENVOYÉS
  // ========================================

  try {

    await imapService.appendSentMessage(

      result.raw

    );

    sentSaved = true;

  } catch (imapError) {

    console.error(

      'Erreur d’enregistrement dans Envoyés :',

      imapError

    );

    warnings.push(

      'La copie du message dans Envoyés n’a pas pu être confirmée.'

    );

  }

  // ========================================
  // 4. RETOURNER LE RÉSULTAT
  // ========================================

  if (warnings.length > 0) {

    return res.status(200).json({

      success: true,

      message:
        'E-mail accepté par le serveur SMTP.',

      warning:
        'E-mail accepté par SMTP. ' +
        warnings.join(' ') +
        ' Ne pas renvoyer ce message.',

      messageId: result.messageId,

      sentSaved,

      interaction

    });

  }

  return res.status(201).json({

    success: true,

    message:
      'E-mail envoyé et enregistré dans Envoyés.',

    messageId: result.messageId,

    sentSaved,

    interaction

  });

}

// ==========================================
// GESTION DES ERREURS
// ==========================================

function handleError(error, res, next) {

  if (error.status === 503) {

    return res.status(503).json({

      message: error.message

    });

  }

  next(error);

}

// ==========================================
// ENVOI DEPUIS UN PROSPECT
// ==========================================

exports.sendToProspect = async (req, res, next) => {

  try {

    const prospect = await Prospect.findByPk(

      req.params.id

    );

    if (!prospect) {

      return res.status(404).json({

        message: 'Prospect introuvable.'

      });

    }

    const linkedClient = await Client.findOne({

      where: {

        prospectId: prospect.id

      }

    });

    if (linkedClient) {

      return res.status(409).json({

        message:
          'Ce prospect est devenu client. Utilise sa fiche client pour envoyer un message.',

        clientId: linkedClient.id

      });

    }

    if (!prospect.email?.trim()) {

      return res.status(400).json({

        message:
          'Ce prospect ne possède pas d’adresse e-mail.'

      });

    }

    const { subject, content } = req.body || {};

    await sendAndRecord({

      recipient: prospect.email.trim(),

      subject,
      content,

      contact: {

        prospectId: prospect.id,

        clientId: null

      },

      res

    });

  } catch (error) {

    handleError(error, res, next);

  }

};

// ==========================================
// ENVOI DEPUIS UN CLIENT
// ==========================================

exports.sendToClient = async (req, res, next) => {

  try {

    const client = await Client.findByPk(

      req.params.id

    );

    if (!client) {

      return res.status(404).json({

        message: 'Client introuvable.'

      });

    }

    if (client.status === 'Archivé') {

      return res.status(409).json({

        message:
          'Ce client est archivé. Réactive-le avant de lui envoyer un message.'

      });

    }

    if (!client.email?.trim()) {

      return res.status(400).json({

        message:
          'Ce client ne possède pas d’adresse e-mail.'

      });

    }

    const { subject, content } = req.body || {};

    await sendAndRecord({

      recipient: client.email.trim(),

      subject,
      content,

      contact: {

        prospectId: client.prospectId ?? null,

        clientId: client.id

      },

      res

    });

  } catch (error) {

    handleError(error, res, next);

  }

};

// ==========================================
// NOUVEAU MESSAGE OU TRANSFERT
// ==========================================

exports.sendNew = async (req, res, next) => {

  try {

    const {

      to,
      subject,
      content

    } = req.body || {};

    if (

      typeof to !== 'string' ||

      !isValidEmail(to.trim())

    ) {

      return res.status(400).json({

        message: 'Adresse e-mail invalide.'

      });

    }

    const recipient = to.trim();

    const contact = await findContactByEmail(

      recipient

    );

    await sendAndRecord({

      recipient,

      subject,
      content,

      contact,

      res

    });

  } catch (error) {

    handleError(error, res, next);

  }

};

// ==========================================
// RÉPONDRE À UN MESSAGE
// ==========================================

exports.reply = async (req, res, next) => {

  try {

    const email = await Email.findByPk(

      req.params.id

    );

    if (!email || email.folder !== 'INBOX') {

      return res.status(404).json({

        message: 'Message reçu introuvable.'

      });

    }

    const { subject, content } = req.body || {};

    const recipient =

      email.fromEmail?.trim() || '';

    let contact = null;

    // Conserver en priorité les associations
    // du message d'origine.

    if (

      email.prospectId != null ||

      email.clientId != null

    ) {

      contact = {

        prospectId: email.prospectId ?? null,

        clientId: email.clientId ?? null

      };

    } else {

      contact = await findContactByEmail(

        recipient

      );

    }

    await sendAndRecord({

      recipient,

      subject,
      content,

      contact,

      originalEmail: email,

      res

    });

  } catch (error) {

    handleError(error, res, next);

  }

};