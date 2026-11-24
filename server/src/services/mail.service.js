
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

async function verifyConnection() {
  await transporter.verify();
  return true;
}

async function sendMail({ to, subject, text, html }) {
  return transporter.sendMail({
    from: {
      name: process.env.SMTP_FROM_NAME || 'MargeWeb',
      address: process.env.SMTP_USER
    },
    to,
    subject,
    text,
    html
  });
}

module.exports = {
  verifyConnection,
  sendMail
};
