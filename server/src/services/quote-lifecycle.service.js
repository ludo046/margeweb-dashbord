const { Quote } = require('../models');

// ==========================================
// CONSTANTES
// ==========================================

const ALLOWED_TRANSITIONS = Object.freeze({

  'Émis': Object.freeze([
    'Envoyé',
    'Accepté',
    'Refusé',
    'Expiré',
    'Annulé'
  ]),

  'Envoyé': Object.freeze([
    'Accepté',
    'Refusé',
    'Expiré',
    'Annulé'
  ])

});

const MAX_REASON_LENGTH = 5000;

// ==========================================
// OUTILS
// ==========================================

function businessError(message, status = 409) {

  const error = new Error(message);

  error.status = status;

  return error;

}

function getBusinessDate(date = new Date()) {

  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {

    throw businessError('Date invalide.', 400);

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

function normalizeReason(value, required = false) {

  if (value === undefined || value === null) {
    value = '';
  }

  if (typeof value !== 'string') {

    throw businessError(
      'Le motif est invalide.',
      400
    );

  }

  const reason = value.trim();

  if (required && !reason) {

    throw businessError(
      'Un motif est obligatoire.',
      400
    );

  }

  if (reason.length > MAX_REASON_LENGTH) {

    throw businessError(
      'Le motif est trop long.',
      400
    );

  }

  return reason;

}

// ==========================================
// VALIDATION DES TRANSITIONS
// ==========================================

function canTransition(currentStatus, targetStatus) {

  if (!Object.hasOwn(
    ALLOWED_TRANSITIONS,
    currentStatus
  )) {
    return false;
  }

  return ALLOWED_TRANSITIONS[
    currentStatus
  ].includes(targetStatus);

}

function ensureTransition(quote, targetStatus) {

  if (!canTransition(
    quote.status,
    targetStatus
  )) {

    throw businessError(

      `Impossible de passer du statut "${quote.status}" ` +
      `au statut "${targetStatus}".`

    );

  }

  if (
    !quote.number ||
    !quote.issueDate ||
    !quote.issuedAt ||
    !quote.issuerSnapshot ||
    !quote.validUntil
  ) {

    throw businessError(
      'Les informations d’émission du devis sont incomplètes.'
    );

  }

  const validityDate = new Date(
    `${quote.validUntil}T00:00:00.000Z`
  );

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      quote.validUntil
    ) ||
    Number.isNaN(validityDate.getTime()) ||
    validityDate.toISOString().slice(0, 10) !==
      quote.validUntil
  ) {

    throw businessError(
      'La date de validité du devis est incohérente.'
    );

  }

}

// ==========================================
// EXPIRATION
// ==========================================

function isQuoteExpired(quote, date = new Date()) {

  if (!quote.validUntil) {
    return false;
  }

  return quote.validUntil < getBusinessDate(date);

}

// ==========================================
// CHANGEMENT DE STATUT
// ==========================================

async function transitionQuote(
  quoteId,
  targetStatus,
  options = {},
  transaction
) {

  if (!transaction || transaction.finished) {

    throw new Error(
      'Une transaction active est obligatoire.'
    );

  }

  if (
    !Number.isSafeInteger(quoteId) ||
    quoteId < 1
  ) {

    throw businessError(
      'Identifiant du devis invalide.',
      400
    );

  }

  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {

    throw businessError(
      'Les paramètres sont invalides.',
      400
    );

  }

  const allowedOptions = [

    'reason'

  ];

  for (const key of Object.keys(options)) {

    if (!allowedOptions.includes(key)) {

      throw businessError(
        `Le paramètre "${key}" est interdit.`,
        400
      );

    }

  }

  const quote = await Quote.findByPk(

    quoteId,

    { transaction }

  );

  if (!quote) {

    throw businessError(
      'Devis introuvable.',
      404
    );

  }

  ensureTransition(
    quote,
    targetStatus
  );

  const now = new Date();

  const expired = isQuoteExpired(
    quote,
    now
  );

  if (
    Object.hasOwn(options, 'reason') &&
    !['Refusé', 'Annulé'].includes(targetStatus)
  ) {

    throw businessError(
      'Aucun motif ne peut être fourni pour cette action.',
      400
    );

  }

  const data = {

    status: targetStatus

  };

  switch (targetStatus) {

    // ======================================
    // ENVOI
    // ======================================

    case 'Envoyé':

      if (expired) {

        throw businessError(
          'Ce devis a dépassé sa date de validité.'
        );

      }

      data.sentAt = now;

      break;

    // ======================================
    // ACCEPTATION
    // ======================================

    case 'Accepté':

      if (expired) {

        throw businessError(
          'Ce devis a expiré. Créez un nouveau devis.'
        );

      }

      data.acceptedAt = now;

      break;

    // ======================================
    // REFUS
    // ======================================

    case 'Refusé':

      data.refusedAt = now;

      data.refusalReason = normalizeReason(
        options.reason
      );

      break;

    // ======================================
    // ANNULATION
    // ======================================

    case 'Annulé':

      data.cancelledAt = now;

      data.cancellationReason = normalizeReason(
        options.reason,
        true
      );

      break;

    // ======================================
    // EXPIRATION
    // ======================================

    case 'Expiré':

      if (!expired) {

        throw businessError(
          'Ce devis est encore valide.'
        );

      }

      break;

    // ======================================
    // STATUT INCONNU
    // ======================================

    default:

      throw businessError(
        'Le statut demandé est invalide.',
        400
      );

  }

  await quote.update(

    data,

    { transaction }

  );

  return quote;

}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {

  canTransition,

  isQuoteExpired,

  transitionQuote

};