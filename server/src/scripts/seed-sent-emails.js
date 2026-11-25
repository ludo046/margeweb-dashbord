
require('dotenv').config();

const { sequelize, Email } = require('../models');

const messages = [
  {
    uid: 1,
    toEmail: 'volcans@example.com',
    subject: 'Création de votre site internet',
    textContent: `Bonjour,

Je me permets de vous contacter concernant le site internet de votre trail.

MargeWeb propose des solutions adaptées aux organisateurs de courses, avec la création et la maintenance de votre site internet.

Seriez-vous disponible pour en discuter ?

Cordialement,
MargeWeb`
  },
  {
    uid: 2,
    toEmail: 'sources@example.com',
    subject: 'Re: Proposition commerciale',
    textContent: `Bonjour,

Merci pour votre retour.

Je peux effectivement vous proposer une formule comprenant la création du site et un abonnement mensuel pour sa maintenance.

Je reste disponible pour échanger.

Cordialement,
MargeWeb`
  },
  {
    uid: 3,
    toEmail: 'vallee@example.com',
    subject: 'Relance - Votre projet de site internet',
    textContent: `Bonjour,

Je reviens vers vous concernant ma précédente proposition.

Avez-vous eu le temps de prendre connaissance de mon message ?

Bonne journée,
MargeWeb`
  },
  {
    uid: 4,
    toEmail: 'association@example.com',
    subject: 'Présentation de MargeWeb',
    textContent: `Bonjour,

MargeWeb accompagne les associations et les organisateurs d'événements dans la création et la gestion de leur présence en ligne.

N'hésitez pas à me contacter pour discuter de vos besoins.

Cordialement,
MargeWeb`
  },
  {
    uid: 5,
    toEmail: 'forets@example.com',
    subject: 'Votre devis de création de site',
    textContent: `Bonjour,

Suite à nos échanges, je vous propose de convenir d'un rendez-vous pour définir les fonctionnalités de votre futur site.

À bientôt,
MargeWeb`
  }
];

async function seed() {

  if (process.env.NODE_ENV !== 'development') {

    throw new Error(
      'Ce script est réservé au développement.'
    );

  }

  await sequelize.authenticate();
  await sequelize.sync();

  for (const message of messages) {

    await Email.findOrCreate({

      where: {
        folder: 'SENT',
        uidValidity: 'demo',
        uid: message.uid
      },

      defaults: {

        messageId:
          `<demo-sent-${message.uid}@example.com>`,

        fromName: 'MargeWeb',
        fromEmail: 'contact@margeweb.fr',

        toEmail: message.toEmail,
        subject: message.subject,
        textContent: message.textContent,
        htmlContent: '',

        receivedAt: new Date(
          Date.now() -
          message.uid * 3600000
        ),

        isRead: true,
        hasAttachments: false,
        prospectId: null

      }

    });

  }

  console.log(
    '5 e-mails envoyés fictifs disponibles.'
  );
}

seed()
  .catch(error => {

    console.error(error);
    process.exitCode = 1;

  })
  .finally(async () => {

    await sequelize.close();

  });
