const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE === 'true',

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },

  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 30000
});

// Génération du message MIME

const mimeTransporter = nodemailer.createTransport({
  streamTransport: true,
  buffer: true,
  newline: 'windows'
});

// Vérification SMTP

async function verifyConnection() {

  await transporter.verify();

  return true;

}

// Envoi d'un message

async function sendMail({
  to,
  subject,
  text,
  html,
  inReplyTo,
  references
}) {

  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD
  ) {

    const error = new Error(
      'Messagerie SMTP non configurée.'
    );

    error.status = 503;

    throw error;

  }

  // Générer le message MIME une seule fois

  const generated = await mimeTransporter.sendMail({

    from: {
      name: process.env.SMTP_FROM_NAME || 'MargeWeb',
      address: process.env.SMTP_USER
    },

    to,
    subject,
    text,
    html,
    inReplyTo,
    references

  });

  // Envoyer le message MIME via SMTP

  const result = await transporter.sendMail({

    envelope: generated.envelope,

    raw: generated.message

  });

  // Retourner également le message original
  // pour son enregistrement dans Envoyés

  return {

    ...result,

    messageId: generated.messageId,

    raw: generated.message

  };

}

module.exports = {
  verifyConnection,
  sendMail
};