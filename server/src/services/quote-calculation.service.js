const ITEM_TYPES = [
  'Ponctuelle',
  'Récurrente'
];

const BILLING_MONTHS = {
  Mensuel: 1,
  Trimestriel: 3,
  Annuel: 12
};

const MAX_UNIT_PRICE_CENTS = 9999999999;
const MAX_ITEMS = 200;

function businessError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {

  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw businessError(`${label} est invalide.`);
  }

  return value;

}

function safeAdd(a, b) {

  const result = a + b;

  if (!Number.isSafeInteger(result)) {
    throw businessError(
      'Le montant total dépasse la limite autorisée.'
    );
  }

  return result;

}

function safeMultiply(a, b) {

  const result = a * b;

  if (!Number.isSafeInteger(result)) {
    throw businessError(
      'Le montant calculé dépasse la limite autorisée.'
    );
  }

  return result;

}

function normalizeText(value, label, maxLength, required = false) {

  if (value === undefined || value === null) {
    value = '';
  }

  if (typeof value !== 'string') {
    throw businessError(`${label} est invalide.`);
  }

  const text = value.trim();

  if (required && !text) {
    throw businessError(`${label} est obligatoire.`);
  }

  if (text.length > maxLength) {
    throw businessError(`${label} est trop long.`);
  }

  return text;

}

// ==========================================
// CALCUL D'UNE LIGNE DE PRESTATION
// ==========================================

function calculateItem(item, position = 0) {

  if (
    !item ||
    typeof item !== 'object' ||
    Array.isArray(item)
  ) {
    throw businessError(
      'La ligne de prestation est invalide.'
    );
  }

  const type = item.type ?? 'Ponctuelle';

  if (!ITEM_TYPES.includes(type)) {
    throw businessError(
      'Le type de prestation est invalide.'
    );
  }

  const name = normalizeText(
    item.name,
    'Le nom de la prestation',
    255,
    true
  );

  const description = normalizeText(
    item.description,
    'La description',
    10000
  );

  const unit = normalizeText(
    item.unit ?? 'Forfait',
    'L’unité',
    50,
    true
  );

  const quantity = integer(
    item.quantity ?? 1,
    'La quantité',
    1,
    10000
  );

  const unitPriceCents = integer(
    item.unitPriceCents,
    'Le prix unitaire',
    0,
    MAX_UNIT_PRICE_CENTS
  );

  const subtotalCents = safeMultiply(
    quantity,
    unitPriceCents
  );

  const discountCents = integer(
    item.discountCents ?? 0,
    'La remise',
    0,
    subtotalCents
  );

  const totalCents =
    subtotalCents - discountCents;

  let billingCycle = item.billingCycle ?? null;
  let commitmentMonths = item.commitmentMonths ?? null;
  const autoRenew = item.autoRenew ?? false;

  if (typeof autoRenew !== 'boolean') {
    throw businessError(
      'Le renouvellement automatique est invalide.'
    );
  }

  if (type === 'Récurrente') {

    if (
      !Object.prototype.hasOwnProperty.call(
        BILLING_MONTHS,
        billingCycle
      )
    ) {
      throw businessError(
        'Le cycle de facturation est invalide.'
      );
    }

    if (commitmentMonths !== null) {

      commitmentMonths = integer(
        commitmentMonths,
        'La durée d’engagement',
        1,
        120
      );

    }

  } else {

    if (
      billingCycle !== null ||
      commitmentMonths !== null ||
      autoRenew
    ) {
      throw businessError(
        'Une prestation ponctuelle ne peut pas ' +
        'comporter de conditions récurrentes.'
      );
    }

  }

  return {
    position: integer(position, 'La position'),
    type,
    name,
    description,
    quantity,
    unit,
    unitPriceCents,
    subtotalCents,
    discountCents,
    totalCents,
    billingCycle,
    commitmentMonths,
    autoRenew
  };

}

// ==========================================
// CALCUL COMPLET DU DEVIS
// ==========================================

function calculateQuote(
  items,
  globalDiscountCents = 0
) {

  if (!Array.isArray(items)) {
    throw businessError(
      'Les prestations doivent être fournies dans un tableau.'
    );
  }

  if (items.length > MAX_ITEMS) {
    throw businessError(
      `Un devis ne peut pas dépasser ${MAX_ITEMS} prestations.`
    );
  }

  const calculatedItems = items.map(
    (item, index) => calculateItem(item, index)
  );

  let subtotalCents = 0;
  let itemDiscountsCents = 0;
  let recurringAnnualCents = 0;

  const recurringByCycle = {
    Mensuel: 0,
    Trimestriel: 0,
    Annuel: 0
  };

  for (const item of calculatedItems) {

    if (item.type === 'Ponctuelle') {

      subtotalCents = safeAdd(
        subtotalCents,
        item.subtotalCents
      );

      itemDiscountsCents = safeAdd(
        itemDiscountsCents,
        item.discountCents
      );

    } else {

      recurringByCycle[item.billingCycle] = safeAdd(
        recurringByCycle[item.billingCycle],
        item.totalCents
      );

      const months =
        BILLING_MONTHS[item.billingCycle];

      const annualAmount = safeMultiply(
        item.totalCents,
        12 / months
      );

      recurringAnnualCents = safeAdd(
        recurringAnnualCents,
        annualAmount
      );

    }

  }

  const afterItemDiscountsCents =
    subtotalCents - itemDiscountsCents;

  const validatedGlobalDiscount = integer(
    globalDiscountCents,
    'La remise globale',
    0,
    afterItemDiscountsCents
  );

  const discountCents = safeAdd(
    itemDiscountsCents,
    validatedGlobalDiscount
  );

  const totalExcludingTaxCents =
    subtotalCents - discountCents;

  // MargeWeb : franchise de TVA

  const taxCents = 0;

  const totalIncludingTaxCents =
    totalExcludingTaxCents;

  return {

    items: calculatedItems,

    totals: {
      subtotalCents,
      discountCents,
      totalExcludingTaxCents,
      taxCents,
      totalIncludingTaxCents
    },

    discounts: {
      itemDiscountsCents,
      globalDiscountCents: validatedGlobalDiscount
    },

    recurring: {
      byBillingCycle: recurringByCycle,

      monthlyCents: Math.round(
        recurringAnnualCents / 12
      ),

      annualCents: recurringAnnualCents
    }

  };

}

module.exports = {
  calculateItem,
  calculateQuote
};