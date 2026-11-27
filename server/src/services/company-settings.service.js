const { CompanySettings } = require('../models');

// ==========================================
// OUTILS
// ==========================================

function businessError(message, status = 409) {

  const error = new Error(message);

  error.status = status;

  return error;

}

function isValidRegistrationNumber(value, length) {

  if (
    typeof value !== 'string' ||
    value.length !== length ||
    !/^\d+$/.test(value) ||
    /^0+$/.test(value)
  ) {
    return false;
  }

  let sum = 0;
  let double = false;

  for (let i = value.length - 1; i >= 0; i--) {

    let digit = Number(value[i]);

    if (double) {

      digit *= 2;

      if (digit > 9) {
        digit -= 9;
      }

    }

    sum += digit;
    double = !double;

  }

  return sum % 10 === 0;

}

// ==========================================
// RÉCUPÉRATION DE LA CONFIGURATION
// ==========================================

async function getCompanySettings(transaction) {

  const settings = await CompanySettings.findByPk(
    1,
    { transaction }
  );

  if (!settings) {

    throw businessError(
      'La configuration de MargeWeb est introuvable.',
      503
    );

  }

  return settings;

}

// ==========================================
// VALIDATION DES INFORMATIONS LÉGALES
// ==========================================

function validateCompanySettings(settings) {

  const errors = [];

  const requiredFields = {

    tradeName: 'Nom commercial',
    legalName: 'Identité légale',
    legalForm: 'Forme juridique',
    siren: 'SIREN',
    siret: 'SIRET',
    address: 'Adresse professionnelle',
    postalCode: 'Code postal',
    city: 'Ville',
    country: 'Pays',
    email: 'Adresse e-mail'

  };

  for (const [field, label] of Object.entries(
    requiredFields
  )) {

    if (
      typeof settings[field] !== 'string' ||
      !settings[field].trim()
    ) {

      errors.push(`${label} manquant.`);

    }

  }

  if (
    !isValidRegistrationNumber(settings.siren, 9)
  ) {

    errors.push('Le SIREN est invalide.');

  }

  if (
    !isValidRegistrationNumber(settings.siret, 14)
  ) {

    errors.push('Le SIRET est invalide.');

  }

  if (
    settings.siren &&
    settings.siret &&
    !settings.siret.startsWith(settings.siren)
  ) {

    errors.push(
      'Le SIRET ne correspond pas au SIREN.'
    );

  }

  if (settings.legalForm !== 'EI') {

    errors.push(
      'Seule la forme juridique EI est actuellement prise en charge.'
    );

  }

  if (settings.country !== 'France') {

    errors.push(
      'Seules les entreprises françaises sont actuellement prises en charge.'
    );

  }

  if (
    !/^\d{5}$/.test(settings.postalCode || '')
  ) {

    errors.push('Le code postal est invalide.');

  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      settings.email || ''
    )
  ) {

    errors.push(
      'L’adresse e-mail professionnelle est invalide.'
    );

  }

  if (settings.currency !== 'EUR') {

    errors.push(
      'Seule la devise EUR est prise en charge.'
    );

  }

  if (settings.taxExempt !== true) {

    errors.push(
      'La gestion des devis avec TVA n’est pas encore disponible.'
    );

  }

  if (
    typeof settings.taxMention !== 'string' ||
    !settings.taxMention.trim()
  ) {

    errors.push(
      'La mention d’exonération de TVA est manquante.'
    );

  }

  if (
    !Number.isInteger(settings.quoteValidityDays) ||
    settings.quoteValidityDays < 1 ||
    settings.quoteValidityDays > 365
  ) {

    errors.push(
      'La durée de validité des devis est invalide.'
    );

  }

  if (
    !settings.legalInformationVerifiedAt ||
    Number.isNaN(
      new Date(
        settings.legalInformationVerifiedAt
      ).getTime()
    )
  ) {

    errors.push(
      'Les informations légales de MargeWeb doivent être confirmées.'
    );

  }

  return {

    valid: errors.length === 0,
    errors

  };

}

// ==========================================
// CONFIGURATION PRÊTE POUR L'ÉMISSION
// ==========================================

async function getValidatedCompanySettings(
  transaction
) {

  const settings = await getCompanySettings(
    transaction
  );

  const validation = validateCompanySettings(
    settings
  );

  if (!validation.valid) {

    throw businessError(

      'Impossible d’émettre le devis : ' +
      validation.errors.join(' ')

    );

  }

  return settings;

}

// ==========================================
// CRÉATION DE L'INSTANTANÉ ENTREPRISE
// ==========================================

function buildIssuerSnapshot(settings) {

  const validation = validateCompanySettings(
    settings
  );

  if (!validation.valid) {

    throw businessError(
      validation.errors.join(' ')
    );

  }

  return {

    tradeName: settings.tradeName,

    legalName: settings.legalName,

    legalForm: settings.legalForm,

    siren: settings.siren,

    siret: settings.siret,

    apeCode: settings.apeCode,

    registrationMention:
      settings.registrationMention,

    address: settings.address,

    addressComplement:
      settings.addressComplement,

    postalCode: settings.postalCode,

    city: settings.city,

    country: settings.country,

    email: settings.email,

    phone: settings.phone,

    website: settings.website,

    currency: settings.currency,

    taxExempt: settings.taxExempt,

    vatNumber: settings.vatNumber,

    taxMention: settings.taxMention,

    legalInformationVerifiedAt:
      new Date(
        settings.legalInformationVerifiedAt
      ).toISOString()

  };

}

// ==========================================
// PARAMÈTRES PAR DÉFAUT DES DEVIS
// ==========================================

function getQuoteDefaults(settings) {

  return {

    validityDays:
      settings.quoteValidityDays,

    paymentTerms:
      settings.defaultQuotePaymentTerms || '',

    deliveryTerms:
      settings.defaultQuoteDeliveryTerms || '',

    termsAndConditions:
      settings.defaultQuoteTermsAndConditions || '',

    publicNotes:
      settings.defaultQuoteNotes || '',

    currency:
      settings.currency,

    taxExempt:
      settings.taxExempt,

    taxMention:
      settings.taxMention

  };

}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {

  getCompanySettings,

  validateCompanySettings,

  getValidatedCompanySettings,

  buildIssuerSnapshot,

  getQuoteDefaults

};