const { QuoteSequence } = require('../models');

// ==========================================
// ANNÉE COMMERCIALE - EUROPE/PARIS
// ==========================================

function getBusinessYear(date = new Date()) {

  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    throw new Error('La date de numérotation est invalide.');
  }

  return Number(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      year: 'numeric'
    }).format(date)
  );

}

// ==========================================
// FORMATAGE DU NUMÉRO
// ==========================================

function formatQuoteNumber(year, sequence) {

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 9999
  ) {
    throw new Error('L’année du devis est invalide.');
  }

  if (
    !Number.isSafeInteger(sequence) ||
    sequence < 1
  ) {
    throw new Error('Le numéro de séquence est invalide.');
  }

  return `DEV-${year}-${String(sequence).padStart(4, '0')}`;

}

// ==========================================
// ATTRIBUTION DU PROCHAIN NUMÉRO
// ==========================================

async function generateQuoteNumber(
  transaction,
  date = new Date()
) {

  if (!transaction || transaction.finished) {
    throw new Error(
      'La numérotation nécessite une transaction active.'
    );
  }

  const year = getBusinessYear(date);

  if (year < 2000 || year > 9999) {
    throw new Error('L’année de numérotation est invalide.');
  }

  // Création du compteur annuel si nécessaire

  const [sequence] = await QuoteSequence.findOrCreate({
    where: {
      year
    },
    defaults: {
      lastNumber: 0
    },
    transaction
  });

  // Vérification du compteur actuel

  const currentNumber = sequence.lastNumber;

  if (
    !Number.isSafeInteger(currentNumber) ||
    currentNumber < 0 ||
    currentNumber >= Number.MAX_SAFE_INTEGER
  ) {
    throw new Error(
      'Le compteur annuel de devis est invalide ou épuisé.'
    );
  }

  // Incrémentation atomique

  await sequence.increment('lastNumber', {
    by: 1,
    transaction
  });

  // Récupération du numéro réellement enregistré

  await sequence.reload({
    transaction
  });

  return formatQuoteNumber(
    year,
    sequence.lastNumber
  );

}

module.exports = {
  getBusinessYear,
  formatQuoteNumber,
  generateQuoteNumber
};