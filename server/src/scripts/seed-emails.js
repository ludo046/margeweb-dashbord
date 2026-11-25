
const { sequelize, Email } = require('../models');

const messages = [
  {
    uid: 1,
    fromName: 'Trail des Volcans',
    fromEmail: 'volcans@example.com',
    subject: 'Re: Proposition de création de site',
    textContent: `Bonjour,

Merci pour votre proposition.

Nous sommes intéressés par la création d'un nouveau site pour notre prochaine édition.

Pourriez-vous nous transmettre un devis ?

Sportivement,
L'équipe du trail`,
    isRead: false
  },
  {
    uid: 2,
    fromName: 'Trail des Sources',
    fromEmail: 'sources@example.com',
    subject: 'Demande de renseignements',
    textContent: `Bonjour,

Nous souhaiterions en savoir plus sur votre offre de maintenance mensuelle.

Merci pour votre retour.`,
    isRead: false
  },
  {
    uid: 3,
    fromName: 'Trail de la Vallée',
    fromEmail: 'vallee@example.com',
    subject: 'Re: Refonte du site internet',
    textContent: `Bonjour,

Nous allons présenter votre proposition lors de notre prochaine réunion.

Nous reviendrons vers vous rapidement.`,
    isRead: true
  },
  {
    uid: 4,
    fromName: 'Association sportive',
    fromEmail: 'association@example.com',
    subject: 'Site internet édition 2027',
    textContent: `Bonjour,

Nous préparons actuellement notre prochaine édition et recherchons un prestataire pour notre site internet.`,
    isRead: true
  },
  {
    uid: 5,
    fromName: 'Trail des Forêts',
    fromEmail: 'forets@example.com',
    subject: 'Merci pour votre proposition',
    textContent: `Bonjour,

Merci pour votre message.

Nous avons déjà un prestataire pour cette année, mais nous conservons vos coordonnées.`,
    isRead: true
  }
];

async function seed() {

  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      'Script réservé au développement.'
    );
  }

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    for (const message of messages) {

      await Email.findOrCreate({
        where: {
          folder: 'INBOX',
          uidValidity: 'demo',
          uid: message.uid
        },

        defaults: {
          ...message,
          messageId: `<demo-${message.uid}@example.com>`,
          toEmail: 'contact@example.com',
          receivedAt: new Date(
            Date.now() - message.uid * 3600000
          ),
          hasAttachments: false
        }
      });

    }

    console.log('5 e-mails fictifs disponibles.');

  } finally {
    await sequelize.close();
  }
}

seed().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
