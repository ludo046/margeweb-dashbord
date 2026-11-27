const {
  Quote,
  QuoteItem
} = require('../models');

// ==========================================
// CONSTANTES
// ==========================================

const QUOTE_STATUSES = [
  'Brouillon',
  'Émis',
  'Envoyé',
  'Accepté',
  'Refusé',
  'Expiré',
  'Annulé'
];

const PENDING_STATUSES = [
  'Émis',
  'Envoyé'
];

const BILLING_MONTHS = {
  Mensuel: 1,
  Trimestriel: 3,
  Annuel: 12
};

const EXPIRATION_ALERT_DAYS = 7;

// ==========================================
// OUTILS
// ==========================================

function businessError(message, status = 400) {

  const error = new Error(message);

  error.status = status;

  return error;

}

function safeAdd(a, b) {

  const result = a + b;

  if (
    !Number.isSafeInteger(a) ||
    !Number.isSafeInteger(b) ||
    !Number.isSafeInteger(result)
  ) {

    throw businessError(
      'Le montant des statistiques dépasse la limite autorisée.',
      500
    );

  }

  return result;

}

function safeMultiply(a, b) {

  const result = a * b;

  if (
    !Number.isSafeInteger(a) ||
    !Number.isSafeInteger(b) ||
    !Number.isSafeInteger(result)
  ) {

    throw businessError(
      'Le montant des statistiques dépasse la limite autorisée.',
      500
    );

  }

  return result;

}

function validateAmount(value) {

  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {

    throw businessError(
      'Un montant enregistré dans un devis est incohérent.',
      500
    );

  }

  return value;

}

function validateId(value, label) {

  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {

    throw businessError(
      `${label} invalide.`
    );

  }

  return value;

}

// ==========================================
// GESTION DES DATES
// ==========================================

function getBusinessDate(date = new Date()) {

  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {

    throw businessError(
      'Date invalide.'
    );

  }

  const parts = new Intl.DateTimeFormat('fr-FR', {

    timeZone: 'Europe/Paris',

    year: 'numeric',

    month: '2-digit',

    day: '2-digit'

  }).formatToParts(date);

  const year = parts.find(
    part => part.type === 'year'
  ).value;

  const month = parts.find(
    part => part.type === 'month'
  ).value;

  const day = parts.find(
    part => part.type === 'day'
  ).value;

  return `${year}-${month}-${day}`;

}

function isValidDate(value) {

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {

    return false;

  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );

}

function addDays(date, days) {

  if (
    !isValidDate(date) ||
    !Number.isInteger(days)
  ) {

    throw businessError(
      'Date invalide.'
    );

  }

  const result = new Date(
    `${date}T00:00:00.000Z`
  );

  result.setUTCDate(
    result.getUTCDate() + days
  );

  return result.toISOString().slice(0, 10);

}

// ==========================================
// STATISTIQUES PAR STATUT
// ==========================================

function createStatusDistribution() {

  const distribution = {};

  for (const status of QUOTE_STATUSES) {

    distribution[status] = {

      count: 0,

      amountCents: 0

    };

  }

  return distribution;

}

// ==========================================
// CALCUL DES PRESTATIONS RÉCURRENTES
// ==========================================

function getRecurringAnnualAmount(items) {

  if (!Array.isArray(items)) {

    throw businessError(
      'Les prestations du devis sont indisponibles.',
      500
    );

  }

  let annualCents = 0;

  for (const item of items) {

    if (item.type !== 'Récurrente') {

      continue;

    }

    if (
      typeof item.billingCycle !== 'string' ||
      !Object.hasOwn(
        BILLING_MONTHS,
        item.billingCycle
      )
    ) {

      throw businessError(
        'Une fréquence de facturation est invalide.',
        500
      );

    }

    const months =
      BILLING_MONTHS[item.billingCycle];

    const amount = validateAmount(
      item.totalCents
    );

    const annualAmount = safeMultiply(
      amount,
      12 / months
    );

    annualCents = safeAdd(
      annualCents,
      annualAmount
    );

  }

  return annualCents;

}

// ==========================================
// CALCUL DES STATISTIQUES
// ==========================================

function calculateQuoteStats(
  quotes,
  date = new Date()
) {

  if (!Array.isArray(quotes)) {

    throw businessError(
      'La liste des devis est invalide.'
    );

  }

  const today = getBusinessDate(date);

  const expirationLimit = addDays(
    today,
    EXPIRATION_ALERT_DAYS
  );

  const byStatus = createStatusDistribution();

  let totalQuotes = 0;

  let pendingQuotes = 0;

  let pendingAmountCents = 0;

  let acceptedQuotes = 0;

  let acceptedAmountCents = 0;

  let refusedQuotes = 0;

  let refusedAmountCents = 0;

  let pendingRecurringAnnualCents = 0;

  let acceptedRecurringAnnualCents = 0;

  let expiringSoonQuotes = 0;

  let expiringSoonAmountCents = 0;

  let overdueQuotes = 0;

  let overdueAmountCents = 0;

  let missingValidityQuotes = 0;

  // ========================================
  // ANALYSE DES DEVIS
  // ========================================

  for (const quote of quotes) {

    if (
      !quote ||
      typeof quote !== 'object' ||
      !QUOTE_STATUSES.includes(quote.status)
    ) {

      throw businessError(
        'Un statut de devis est incohérent.',
        500
      );

    }

    const amount = validateAmount(
      quote.totalIncludingTaxCents
    );

    totalQuotes++;

    // Répartition selon le statut enregistré

    byStatus[quote.status].count++;

    byStatus[quote.status].amountCents =
      safeAdd(
        byStatus[quote.status].amountCents,
        amount
      );

    // ======================================
    // DEVIS ACCEPTÉS
    // ======================================

    if (quote.status === 'Accepté') {

      acceptedQuotes++;

      acceptedAmountCents = safeAdd(
        acceptedAmountCents,
        amount
      );

      acceptedRecurringAnnualCents =
        safeAdd(

          acceptedRecurringAnnualCents,

          getRecurringAnnualAmount(
            quote.items
          )

        );

      continue;

    }

    // ======================================
    // DEVIS REFUSÉS
    // ======================================

    if (quote.status === 'Refusé') {

      refusedQuotes++;

      refusedAmountCents = safeAdd(
        refusedAmountCents,
        amount
      );

      continue;

    }

    // ======================================
    // DEVIS EN ATTENTE
    // ======================================

    if (
      !PENDING_STATUSES.includes(
        quote.status
      )
    ) {

      continue;

    }

    // Contrôle de la date de validité

    if (!isValidDate(quote.validUntil)) {

      missingValidityQuotes++;

      continue;

    }

    // ======================================
    // VALIDITÉ DÉPASSÉE
    // ======================================

    if (quote.validUntil < today) {

      overdueQuotes++;

      overdueAmountCents = safeAdd(
        overdueAmountCents,
        amount
      );

      continue;

    }

    // ======================================
    // DEVIS ENCORE VALIDES
    // ======================================

    pendingQuotes++;

    pendingAmountCents = safeAdd(
      pendingAmountCents,
      amount
    );

    pendingRecurringAnnualCents =
      safeAdd(

        pendingRecurringAnnualCents,

        getRecurringAnnualAmount(
          quote.items
        )

      );

    // ======================================
    // EXPIRATION PROCHAINE
    // ======================================

    if (quote.validUntil <= expirationLimit) {

      expiringSoonQuotes++;

      expiringSoonAmountCents = safeAdd(
        expiringSoonAmountCents,
        amount
      );

    }

  }

  // ========================================
  // TAUX D'ACCEPTATION
  // ========================================

  const answeredQuotes =
    acceptedQuotes + refusedQuotes;

  const acceptanceRate = answeredQuotes > 0

    ? Math.round(
        acceptedQuotes / answeredQuotes * 10000
      ) / 100

    : null;

  // ========================================
  // MONTANT MOYEN ACCEPTÉ
  // ========================================

  const averageAcceptedAmountCents =
    acceptedQuotes > 0

      ? Math.round(
          acceptedAmountCents / acceptedQuotes
        )

      : null;

  // ========================================
  // ÉQUIVALENTS MENSUELS
  // ========================================

  const pendingRecurringMonthlyCents =
    Math.round(
      pendingRecurringAnnualCents / 12
    );

  const acceptedRecurringMonthlyCents =
    Math.round(
      acceptedRecurringAnnualCents / 12
    );

  // ========================================
  // RÉSULTAT
  // ========================================

  return {

    asOfDate: today,

    currency: 'EUR',

    expirationAlertDays:
      EXPIRATION_ALERT_DAYS,

    totalQuotes,

    draftQuotes:
      byStatus['Brouillon'].count,

    issuedQuotes:
      byStatus['Émis'].count,

    sentQuotes:
      byStatus['Envoyé'].count,

    acceptedQuotes,

    refusedQuotes,

    expiredQuotes:
      byStatus['Expiré'].count,

    cancelledQuotes:
      byStatus['Annulé'].count,

    pendingQuotes,

    answeredQuotes,

    pendingAmountCents,

    acceptedAmountCents,

    refusedAmountCents,

    averageAcceptedAmountCents,

    acceptanceRate,

    pendingRecurringMonthlyCents,

    pendingRecurringAnnualCents,

    acceptedRecurringMonthlyCents,

    acceptedRecurringAnnualCents,

    expiringSoonQuotes,

    expiringSoonAmountCents,

    overdueQuotes,

    overdueAmountCents,

    missingValidityQuotes,

    byStatus

  };

}

// ==========================================
// RÉCUPÉRATION DEPUIS LA BASE
// ==========================================

async function getQuoteStats(
  filters = {},
  transaction
) {

  if (
    !filters ||
    typeof filters !== 'object' ||
    Array.isArray(filters)
  ) {

    throw businessError(
      'Les filtres sont invalides.'
    );

  }

  const allowedFields = [
    'prospectId',
    'clientId'
  ];

  for (const key of Object.keys(filters)) {

    if (!allowedFields.includes(key)) {

      throw businessError(
        `Le filtre "${key}" est invalide.`
      );

    }

  }

  const where = {};

  if (filters.prospectId !== undefined) {

    where.prospectId = validateId(

      filters.prospectId,

      'Identifiant du prospect'

    );

  }

  if (filters.clientId !== undefined) {

    where.clientId = validateId(

      filters.clientId,

      'Identifiant du client'

    );

  }

  const quotes = await Quote.findAll({

    where,

    attributes: [

      'id',

      'status',

      'validUntil',

      'totalIncludingTaxCents'

    ],

    include: [

      {

        model: QuoteItem,

        as: 'items',

        attributes: [

          'id',

          'type',

          'totalCents',

          'billingCycle'

        ]

      }

    ],

    transaction

  });

  return calculateQuoteStats(quotes);

}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {

  calculateQuoteStats,

  getQuoteStats

};