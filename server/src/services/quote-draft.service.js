const {
  Quote,
  QuoteItem,
  Prospect,
  Client
} = require('../models');

const {
  calculateQuote
} = require('./quote-calculation.service');

const {
  getCompanySettings,
  getQuoteDefaults
} = require('./company-settings.service');

// ==========================================
// CONSTANTES
// ==========================================

const RECIPIENT_FIELDS = [
  'recipientName',
  'recipientLegalName',
  'recipientContactName',
  'recipientEmail',
  'recipientPhone',
  'recipientAddress',
  'recipientPostalCode',
  'recipientCity',
  'recipientCountry',
  'recipientSiret'
];

const COMMERCIAL_FIELDS = [
  'title',
  'paymentTerms',
  'deliveryTerms',
  'termsAndConditions',
  'publicNotes',
  'internalNotes'
];

const ITEM_FIELDS = [
  'type',
  'name',
  'description',
  'quantity',
  'unit',
  'unitPriceCents',
  'discountCents',
  'billingCycle',
  'commitmentMonths',
  'autoRenew'
];

// ==========================================
// OUTILS
// ==========================================

function businessError(message, status = 409) {

  const error = new Error(message);

  error.status = status;

  return error;

}

function ensureTransaction(transaction) {

  if (!transaction || transaction.finished) {

    throw new Error(
      'Une transaction active est obligatoire.'
    );

  }

}

function ensureQuoteId(quoteId) {

  if (
    !Number.isSafeInteger(quoteId) ||
    quoteId < 1
  ) {

    throw businessError(
      'Identifiant du devis invalide.',
      400
    );

  }

}

function copyFields(source, fields) {

  const result = {};

  for (const field of fields) {

    result[field] = source[field];

  }

  return result;

}

// ==========================================
// RÉCUPÉRATION DU DEVIS ORIGINAL
// ==========================================

async function getSourceQuote(
  quoteId,
  transaction
) {

  const quote = await Quote.findByPk(

    quoteId,

    {
      transaction
    }

  );

  if (!quote) {

    throw businessError(
      'Devis introuvable.',
      404
    );

  }

  return quote;

}

// ==========================================
// VÉRIFICATION DU DESTINATAIRE
// ==========================================

async function resolveRecipient(
  quote,
  transaction
) {

  let prospect = null;
  let client = null;

  if (quote.prospectId !== null) {

    prospect = await Prospect.findByPk(
      quote.prospectId,
      { transaction }
    );

    if (!prospect) {

      throw businessError(
        'Le prospect associé au devis est introuvable.'
      );

    }

  }

  if (quote.clientId !== null) {

    client = await Client.findByPk(
      quote.clientId,
      { transaction }
    );

    if (!client) {

      throw businessError(
        'Le client associé au devis est introuvable.'
      );

    }

  }

  if (!prospect && !client) {

    throw businessError(
      'Ce devis ne possède aucun destinataire valide.'
    );

  }

  if (
    prospect &&
    client &&
    client.prospectId !== prospect.id
  ) {

    throw businessError(
      'Les relations du destinataire sont incohérentes.'
    );

  }

  // Recherche du client après conversion

  if (prospect && !client) {

    client = await Client.findOne({

      where: {
        prospectId: prospect.id
      },

      transaction

    });

  }

  // Recherche du prospect d'origine

  if (client && !prospect && client.prospectId) {

    prospect = await Prospect.findByPk(
      client.prospectId,
      { transaction }
    );

  }

  if (client && client.status === 'Archivé') {

    throw businessError(
      'Ce client est archivé. Réactivez-le avant de dupliquer son devis.'
    );

  }

  return {

    prospectId: prospect?.id ?? null,

    clientId: client?.id ?? null

  };

}

// ==========================================
// RÉCUPÉRATION DE LA REMISE GLOBALE
// ==========================================

function getGlobalDiscount(quote, items) {

  const itemDiscounts = items

    .filter(
      item => item.type === 'Ponctuelle'
    )

    .reduce(
      (total, item) => total + item.discountCents,
      0
    );

  const globalDiscount =
    quote.discountCents - itemDiscounts;

  if (
    !Number.isSafeInteger(itemDiscounts) ||
    !Number.isSafeInteger(globalDiscount) ||
    globalDiscount < 0
  ) {

    throw businessError(
      'Les remises du devis original sont incohérentes.'
    );

  }

  return globalDiscount;

}

// ==========================================
// DUPLICATION D'UN DEVIS
// ==========================================

async function duplicateQuote(
  quoteId,
  transaction
) {

  ensureTransaction(transaction);

  ensureQuoteId(quoteId);

  // Récupération du devis original

  const source = await getSourceQuote(
    quoteId,
    transaction
  );

  // Vérification du destinataire

  const recipient = await resolveRecipient(
    source,
    transaction
  );

  // Récupération des prestations originales

  const sourceItems = await QuoteItem.findAll({

    where: {
      quoteId: source.id
    },

    order: [
      ['position', 'ASC'],
      ['id', 'ASC']
    ],

    transaction

  });

  // Copie des données commerciales

  const items = sourceItems.map(item =>

    copyFields(
      item,
      ITEM_FIELDS
    )

  );

  // Conservation de la remise globale

  const globalDiscountCents =
    getGlobalDiscount(
      source,
      sourceItems
    );

  // Recalcul des montants du nouveau devis

  const calculation = calculateQuote(
    items,
    globalDiscountCents
  );

  // Récupération des paramètres actuels

  const settings = await getCompanySettings(
    transaction
  );

  const defaults = getQuoteDefaults(settings);

  if (
    defaults.currency !== 'EUR' ||
    defaults.taxExempt !== true
  ) {

    throw businessError(
      'La configuration fiscale actuelle n’est pas prise en charge.'
    );

  }

  // Création du nouveau brouillon

  const duplicate = await Quote.create({

    ...copyFields(
      source,
      RECIPIENT_FIELDS
    ),

    ...copyFields(
      source,
      COMMERCIAL_FIELDS
    ),

    ...calculation.totals,

    ...recipient,

    number: null,

    status: 'Brouillon',

    issueDate: null,

    validUntil: null,

    issuerSnapshot: null,

    currency: defaults.currency,

    taxExempt: defaults.taxExempt,

    taxMention: defaults.taxMention,

    issuedAt: null,

    sentAt: null,

    acceptedAt: null,

    refusedAt: null,

    cancelledAt: null,

    refusalReason: '',

    cancellationReason: ''

  }, {

    transaction

  });

  // Création des nouvelles prestations

  if (calculation.items.length > 0) {

    await QuoteItem.bulkCreate(

      calculation.items.map(item => ({

        ...item,

        quoteId: duplicate.id

      })),

      {

        transaction,

        validate: true

      }

    );

  }

  return duplicate;

}

// ==========================================
// VALIDATION AVANT SUPPRESSION
// ==========================================

function ensureDeletableDraft(quote) {

  if (quote.status !== 'Brouillon') {

    throw businessError(
      'Seuls les devis en brouillon peuvent être supprimés.'
    );

  }

  if (
    quote.number !== null ||
    quote.issueDate !== null ||
    quote.issuedAt !== null ||
    quote.issuerSnapshot !== null ||
    quote.sentAt !== null ||
    quote.acceptedAt !== null ||
    quote.refusedAt !== null ||
    quote.cancelledAt !== null
  ) {

    throw businessError(
      'Ce devis contient des informations d’émission ou un historique commercial. Sa suppression est interdite.'
    );

  }

}

// ==========================================
// SUPPRESSION D'UN BROUILLON
// ==========================================

async function deleteDraft(
  quoteId,
  transaction
) {

  ensureTransaction(transaction);

  ensureQuoteId(quoteId);

  const quote = await getSourceQuote(
    quoteId,
    transaction
  );

  // Vérification de l'éligibilité

  ensureDeletableDraft(quote);

  // Suppression des prestations associées

  const deletedItems = await QuoteItem.destroy({

    where: {
      quoteId: quote.id
    },

    transaction

  });

  // Suppression du brouillon

  await quote.destroy({

    transaction

  });

  return {

    success: true,

    message: 'Le brouillon a été supprimé.',

    deletedQuoteId: quoteId,

    deletedItems

  };

}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {

  duplicateQuote,

  deleteDraft,

  ensureDeletableDraft

};