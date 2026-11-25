
const { Prospect, Interaction, Email } = require('../models');
const mailService = require('../services/mail.service');

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

async function findProspectByEmail(email) {

  const prospects = await Prospect.findAll();

  const matches = prospects.filter(prospect =>
    prospect.email?.trim().toLowerCase() ===
    email.trim().toLowerCase()
  );

  return matches.length === 1
    ? matches[0]
    : null;
}

async function sendAndRecord({
  recipient,
  subject,
  content,
  prospect,
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

  let interaction;

  try {

    if (prospect) {

      interaction = await Interaction.create({
        prospectId: prospect.id,
        type: 'email_sent',
        subject: subject.trim(),
        content: content.trim()
      });

    }

    return res.status(201).json({
      success: true,
      message: 'E-mail accepté par le serveur SMTP.',
      messageId: result.messageId,
      interaction
    });

  } catch (historyError) {

    console.error(historyError);

    return res.status(200).json({
      success: true,
      warning: 'E-mail envoyé, mais historique non enregistré. Ne pas renvoyer.',
      messageId: result.messageId
    });

  }
}

// Envoi depuis une fiche prospect
exports.sendToProspect = async (req, res, next) => {

  try {

    const prospect = await Prospect.findByPk(req.params.id);

    if (!prospect) {
      return res.status(404).json({
        message: 'Prospect introuvable.'
      });
    }

    if (!prospect.email?.trim()) {
      return res.status(400).json({
        message: 'Ce prospect ne possède pas d’adresse e-mail.'
      });
    }

    const { subject, content } = req.body || {};

    await sendAndRecord({
      recipient: prospect.email.trim(),
      subject,
      content,
      prospect,
      res
    });

  } catch (error) {

    if (error.status === 503) {
      return res.status(503).json({
        message: error.message
      });
    }

    next(error);
  }
};

// Nouveau message
exports.sendNew = async (req, res, next) => {

  try {

    const { to, subject, content } = req.body || {};

    if (!isValidEmail(to?.trim?.())) {
      return res.status(400).json({
        message: 'Adresse e-mail invalide.'
      });
    }

    const recipient = to.trim();

    const prospect = await findProspectByEmail(recipient);

    await sendAndRecord({
      recipient,
      subject,
      content,
      prospect,
      res
    });

  } catch (error) {

    if (error.status === 503) {
      return res.status(503).json({
        message: error.message
      });
    }

    next(error);
  }
};

// Répondre à un message reçu
exports.reply = async (req, res, next) => {

  try {

    const email = await Email.findByPk(req.params.id);

    if (!email || email.folder !== 'INBOX') {
      return res.status(404).json({
        message: 'Message reçu introuvable.'
      });
    }

    const { subject, content } = req.body || {};

    const recipient = email.fromEmail?.trim() || '';

    const prospect = await findProspectByEmail(recipient);

    await sendAndRecord({
      recipient,
      subject,
      content,
      prospect,
      originalEmail: email,
      res
    });

  } catch (error) {

    if (error.status === 503) {
      return res.status(503).json({
        message: error.message
      });
    }

    next(error);
  }
};
