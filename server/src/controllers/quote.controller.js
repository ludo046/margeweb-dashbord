const { Op, Transaction } = require('sequelize');

const {
  sequelize,
  Quote,
  QuoteItem,
  Prospect,
  Client
} = require('../models');

const {
  calculateQuote
} = require('../services/quote-calculation.service');

const {
  generateQuoteNumber
} = require('../services/quote-number.service');

const {
  getCompanySettings,
  getValidatedCompanySettings,
  buildIssuerSnapshot,
  getQuoteDefaults
} = require('../services/company-settings.service');

const {
  transitionQuote
} = require('../services/quote-lifecycle.service');

const {
  duplicateQuote,
  deleteDraft
} = require('../services/quote-draft.service');

const {
  getQuoteStats
} = require('../services/quote-stats.service');

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

const TEXT_FIELDS = [
  'paymentTerms',
  'deliveryTerms',
  'termsAndConditions',
  'publicNotes',
  'internalNotes'
];

const EDITABLE_FIELDS = [
  'title',
  'validUntil',
  'items',
  'globalDiscountCents',
  ...RECIPIENT_FIELDS,
  ...TEXT_FIELDS
];

const CREATE_FIELDS = [
  ...EDITABLE_FIELDS,
  'prospectId',
  'clientId'
];

const QUOTE_INCLUDE = [
  {
    model: Prospect,
    as: 'prospect',
    attributes: ['id', 'name', 'email', 'status']
  },
  {
    model: Client,
    as: 'client',
    attributes: ['id', 'name', 'legalName', 'email', 'status']
  },
  {
    model: QuoteItem,
    as: 'items'
  }
];

// ==========================================
// OUTILS DE VALIDATION
// ==========================================

function businessError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseId(value, label = 'Identifiant') {

  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {
    throw businessError(`${label} invalide.`);
  }

  if (!/^[1-9]\d*$/.test(String(value))) {
    throw businessError(`${label} invalide.`);
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id)) {
    throw businessError(`${label} invalide.`);
  }

  return id;
}

function normalizeText(
  value,
  label,
  maxLength = 255,
  required = false
) {

  if (typeof value !== 'string') {
    throw businessError(`${label} invalide.`);
  }

  const text = value.trim();

  if (required && !text) {
    throw businessError(`${label} obligatoire.`);
  }

  if (text.length > maxLength) {
    throw businessError(`${label} trop long.`);
  }

  return text;
}

function validateDate(value, label) {

  if (value === null || value === '') {
    return null;
  }

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw businessError(`${label} invalide.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    Number(value.slice(0, 4)) < 2000
  ) {
    throw businessError(`${label} invalide.`);
  }

  return value;
}

function validateBody(body, allowedFields) {

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw businessError(
      'Les données du devis sont invalides.'
    );
  }

  for (const key of Object.keys(body)) {

    if (!allowedFields.includes(key)) {
      throw businessError(
        `Le champ "${key}" ne peut pas être modifié.`
      );
    }

  }
}

function sanitizeQuoteData(body) {

  const data = {};

  if (Object.hasOwn(body, 'title')) {

    data.title = normalizeText(
      body.title,
      'Le titre',
      255,
      true
    );

  }

  if (Object.hasOwn(body, 'validUntil')) {

    data.validUntil = validateDate(
      body.validUntil,
      'La date de validité'
    );

  }

  for (const field of RECIPIENT_FIELDS) {

    if (Object.hasOwn(body, field)) {
      data[field] = normalizeText(
        body[field],
        field,
        255
      );
    }

  }

  for (const field of TEXT_FIELDS) {

    if (Object.hasOwn(body, field)) {
      data[field] = normalizeText(
        body[field],
        field,
        20000
      );
    }

  }

  if (
    data.recipientEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      data.recipientEmail
    )
  ) {
    throw businessError(
      'L’adresse e-mail du destinataire est invalide.'
    );
  }

  return data;
}

// ==========================================
// GESTION DES ERREURS SQLITE
// ==========================================

function handleWriteError(error, next) {

  if (
    error.original?.code === 'SQLITE_BUSY' ||
    error.parent?.code === 'SQLITE_BUSY'
  ) {

    return next(
      businessError(
        'La base de données est occupée. Vérifiez la liste et le statut des devis avant de réessayer.',
        503
      )
    );

  }

  return next(error);
}

// ==========================================
// GESTION DES DATES
// ==========================================

function getBusinessDate(date = new Date()) {

  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    throw businessError('Date invalide.');
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

function addDays(date, days) {

  validateDate(date, 'La date');

  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  ) {
    throw businessError(
      'La durée de validité est invalide.'
    );
  }

  const result = new Date(
    `${date}T00:00:00.000Z`
  );

  result.setUTCDate(
    result.getUTCDate() + days
  );

  return validateDate(
    result.toISOString().slice(0, 10),
    'La date de validité'
  );
}

// ==========================================
// DESTINATAIRE DU DEVIS
// ==========================================

function ensureClientWritable(client) {

  if (client && client.status === 'Archivé') {

    throw businessError(
      'Ce client est archivé. Réactivez-le avant de créer ou modifier un devis.',
      409
    );

  }
}

async function resolveRecipient(body, transaction) {

  let prospect = null;
  let client = null;

  if (
    body.prospectId !== undefined &&
    body.prospectId !== null
  ) {

    const prospectId = parseId(
      body.prospectId,
      'Identifiant du prospect'
    );

    prospect = await Prospect.findByPk(
      prospectId,
      { transaction }
    );

    if (!prospect) {
      throw businessError(
        'Prospect introuvable.',
        404
      );
    }

  }

  if (
    body.clientId !== undefined &&
    body.clientId !== null
  ) {

    const clientId = parseId(
      body.clientId,
      'Identifiant du client'
    );

    client = await Client.findByPk(
      clientId,
      { transaction }
    );

    if (!client) {
      throw businessError(
        'Client introuvable.',
        404
      );
    }

  }

  if (!prospect && !client) {

    throw businessError(
      'Sélectionnez un prospect ou un client.'
    );

  }

  if (
    prospect &&
    client &&
    client.prospectId !== prospect.id
  ) {

    throw businessError(
      'Le prospect et le client sélectionnés ne correspondent pas.'
    );

  }

  // Recherche du client si le prospect a été converti

  if (prospect && !client) {

    client = await Client.findOne({
      where: {
        prospectId: prospect.id
      },
      transaction
    });

  }

  // Récupération du prospect d'origine

  if (client && !prospect && client.prospectId) {

    prospect = await Prospect.findByPk(
      client.prospectId,
      { transaction }
    );

  }

  ensureClientWritable(client);

  return {
    prospect,
    client
  };
}

function buildRecipientSnapshot(prospect, client) {

  if (client) {

    return {
      recipientName: client.name || '',
      recipientLegalName: client.legalName || '',
      recipientContactName: client.contactName || '',
      recipientEmail: client.email || '',
      recipientPhone: client.phone || '',
      recipientAddress: client.address || '',
      recipientPostalCode: client.postalCode || '',
      recipientCity: client.city || '',
      recipientCountry: client.country || 'France',
      recipientSiret: client.siret || ''
    };

  }

  return {
    recipientName: prospect.name || '',
    recipientLegalName: '',
    recipientContactName: '',
    recipientEmail: prospect.email || '',
    recipientPhone: prospect.phone || '',
    recipientAddress: '',
    recipientPostalCode: '',
    recipientCity: '',
    recipientCountry: 'France',
    recipientSiret: ''
  };
}

// ==========================================
// OUTILS DE CONSULTATION
// ==========================================

async function getQuote(id, transaction) {

  const quote = await Quote.findByPk(id, {

    include: QUOTE_INCLUDE,

    order: [
      [
        { model: QuoteItem, as: 'items' },
        'position',
        'ASC'
      ],
      [
        { model: QuoteItem, as: 'items' },
        'id',
        'ASC'
      ]
    ],

    transaction

  });

  if (!quote) {
    throw businessError(
      'Devis introuvable.',
      404
    );
  }

  return quote;
}

function ensureDraft(quote) {

  if (quote.status !== 'Brouillon') {

    throw businessError(
      'Seuls les devis en brouillon peuvent être modifiés.',
      409
    );

  }
}

function getGlobalDiscount(quote, items) {

  const itemDiscounts = items
    .filter(item => item.type === 'Ponctuelle')
    .reduce(
      (total, item) => total + item.discountCents,
      0
    );

  const globalDiscount =
    quote.discountCents - itemDiscounts;

  if (
    !Number.isSafeInteger(globalDiscount) ||
    globalDiscount < 0
  ) {

    throw businessError(
      'Les remises enregistrées dans ce devis sont incohérentes.',
      409
    );

  }

  return globalDiscount;
}

function serializeQuote(quote) {

  const result = quote.toJSON();

  const items = (result.items || []).sort(
    (a, b) =>
      a.position - b.position ||
      a.id - b.id
  );

  const globalDiscountCents =
    getGlobalDiscount(result, items);

  const calculation = calculateQuote(
    items,
    globalDiscountCents
  );

  return {
    ...result,
    items,
    globalDiscountCents,
    itemDiscountsCents:
      calculation.discounts.itemDiscountsCents,
    recurring: calculation.recurring
  };
}

// ==========================================
// VALIDATION AVANT ÉMISSION
// ==========================================

function validateQuoteForIssue(
  quote,
  calculation,
  issueDate,
  validUntil
) {

  const errors = [];

  const requiredFields = {
    title: 'Titre du devis',
    recipientName: 'Nom du destinataire',
    recipientAddress: 'Adresse du destinataire',
    recipientPostalCode: 'Code postal du destinataire',
    recipientCity: 'Ville du destinataire',
    recipientCountry: 'Pays du destinataire',
    paymentTerms: 'Conditions de paiement',
    deliveryTerms: 'Délais de réalisation'
  };

  for (const [field, label] of Object.entries(
    requiredFields
  )) {

    if (
      typeof quote[field] !== 'string' ||
      !quote[field].trim()
    ) {
      errors.push(`${label} manquant.`);
    }

  }

  if (
    quote.recipientEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      quote.recipientEmail
    )
  ) {

    errors.push(
      'L’adresse e-mail du destinataire est invalide.'
    );

  }

  if (
    quote.recipientCountry === 'France' &&
    !/^\d{5}$/.test(
      quote.recipientPostalCode || ''
    )
  ) {

    errors.push(
      'Le code postal du destinataire est invalide.'
    );

  }

  if (
    quote.recipientSiret &&
    !/^\d{14}$/.test(quote.recipientSiret)
  ) {

    errors.push(
      'Le SIRET du destinataire est invalide.'
    );

  }

  if (calculation.items.length === 0) {

    errors.push(
      'Le devis doit contenir au moins une prestation.'
    );

  }

  if (
    calculation.totals.taxCents !== 0 ||
    quote.taxExempt !== true
  ) {

    errors.push(
      'La gestion de la TVA n’est pas encore disponible.'
    );

  }

  if (!validUntil || validUntil < issueDate) {

    errors.push(
      'La date de validité ne peut pas être antérieure à la date d’émission.'
    );

  }

  if (
    quote.number !== null ||
    quote.issuedAt !== null ||
    quote.issueDate !== null ||
    quote.issuerSnapshot !== null
  ) {

    errors.push(
      'Ce brouillon contient déjà des informations d’émission.'
    );

  }

  // Vérification des montants enregistrés

  for (const [field, value] of Object.entries(
    calculation.totals
  )) {

    if (quote[field] !== value) {

      errors.push(
        'Les montants enregistrés sont incohérents. Enregistrez de nouveau le brouillon.'
      );

      break;

    }

  }

  // Vérification des montants de chaque prestation

  for (let i = 0; i < calculation.items.length; i++) {

    const stored = quote.items[i];
    const calculated = calculation.items[i];

    if (
      stored.position !== calculated.position ||
      stored.subtotalCents !== calculated.subtotalCents ||
      stored.discountCents !== calculated.discountCents ||
      stored.totalCents !== calculated.totalCents
    ) {

      errors.push(
        `Les montants de la prestation ${i + 1} sont incohérents.`
      );

    }

  }

  if (errors.length > 0) {

    throw businessError(
      'Impossible d’émettre le devis : ' +
      errors.join(' '),
      409
    );

  }
}

// ==========================================
// LISTE DES DEVIS
// GET /api/quotes
// ==========================================

async function findAll(req, res, next) {

  try {

    const where = {};

    if (req.query.status !== undefined) {

      if (!QUOTE_STATUSES.includes(req.query.status)) {

        throw businessError(
          'Le statut du devis est invalide.'
        );

      }

      where.status = req.query.status;

    }

    if (req.query.prospectId !== undefined) {

      where.prospectId = parseId(
        req.query.prospectId,
        'Identifiant du prospect'
      );

    }

    if (req.query.clientId !== undefined) {

      where.clientId = parseId(
        req.query.clientId,
        'Identifiant du client'
      );

    }

    if (req.query.search !== undefined) {

      const search = normalizeText(
        req.query.search,
        'La recherche',
        255
      );

      if (search) {

        where[Op.or] = [
          {
            number: {
              [Op.like]: `%${search}%`
            }
          },
          {
            title: {
              [Op.like]: `%${search}%`
            }
          },
          {
            recipientName: {
              [Op.like]: `%${search}%`
            }
          },
          {
            recipientLegalName: {
              [Op.like]: `%${search}%`
            }
          },
          {
            recipientEmail: {
              [Op.like]: `%${search}%`
            }
          }
        ];

      }

    }

    const quotes = await Quote.findAll({

      where,

      include: QUOTE_INCLUDE,

      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
        [
          { model: QuoteItem, as: 'items' },
          'position',
          'ASC'
        ],
        [
          { model: QuoteItem, as: 'items' },
          'id',
          'ASC'
        ]
      ]

    });

    res.json(
      quotes.map(serializeQuote)
    );

  } catch (error) {
    next(error);
  }
}

// ==========================================
// STATISTIQUES COMMERCIALES
// GET /api/quotes/stats
// ==========================================

async function getStats(req, res, next) {

  try {

    const allowedFilters = [
      'prospectId',
      'clientId'
    ];

    const filters = {};

    // Refus des filtres non pris en charge

    for (const key of Object.keys(req.query)) {

      if (!allowedFilters.includes(key)) {

        throw businessError(
          `Le filtre "${key}" est invalide.`
        );

      }

    }

    // Filtre par prospect

    if (req.query.prospectId !== undefined) {

      filters.prospectId = parseId(
        req.query.prospectId,
        'Identifiant du prospect'
      );

    }

    // Filtre par client

    if (req.query.clientId !== undefined) {

      filters.clientId = parseId(
        req.query.clientId,
        'Identifiant du client'
      );

    }

    // Calcul des statistiques en lecture seule

    const stats = await getQuoteStats(filters);

    res.json(stats);

  } catch (error) {

    next(error);

  }
}

// ==========================================
// CONSULTATION D'UN DEVIS
// GET /api/quotes/:id
// ==========================================

async function findOne(req, res, next) {

  try {

    const id = parseId(
      req.params.id,
      'Identifiant du devis'
    );

    const quote = await getQuote(id);

    res.json(
      serializeQuote(quote)
    );

  } catch (error) {
    next(error);
  }
}

// ==========================================
// CRÉATION D'UN BROUILLON
// POST /api/quotes
// ==========================================

async function create(req, res, next) {

  try {

    const body = req.body;

    validateBody(
      body,
      CREATE_FIELDS
    );

    const data = sanitizeQuoteData(body);

    if (!data.title) {

      throw businessError(
        'Le titre du devis est obligatoire.'
      );

    }

    const calculation = calculateQuote(

      Object.hasOwn(body, 'items')
        ? body.items
        : [],

      Object.hasOwn(body, 'globalDiscountCents')
        ? body.globalDiscountCents
        : 0

    );

    const result = await sequelize.transaction({

      type: Transaction.TYPES.IMMEDIATE

    }, async transaction => {

      const {
        prospect,
        client
      } = await resolveRecipient(
        body,
        transaction
      );

      const recipientSnapshot =
        buildRecipientSnapshot(
          prospect,
          client
        );

      const settings = await getCompanySettings(
        transaction
      );

      const defaults = getQuoteDefaults(settings);

      if (
        defaults.currency !== 'EUR' ||
        defaults.taxExempt !== true
      ) {

        throw businessError(
          'La configuration fiscale actuelle n’est pas prise en charge.',
          409
        );

      }

      const quote = await Quote.create({

        paymentTerms: defaults.paymentTerms,

        deliveryTerms: defaults.deliveryTerms,

        termsAndConditions:
          defaults.termsAndConditions,

        publicNotes: defaults.publicNotes,

        ...recipientSnapshot,
        ...data,
        ...calculation.totals,

        prospectId: prospect?.id ?? null,
        clientId: client?.id ?? null,

        number: null,
        status: 'Brouillon',

        issueDate: null,
        issuerSnapshot: null,

        currency: defaults.currency,

        taxExempt: defaults.taxExempt,

        taxMention: defaults.taxMention

      }, {

        transaction

      });

      if (calculation.items.length > 0) {

        await QuoteItem.bulkCreate(

          calculation.items.map(item => ({
            ...item,
            quoteId: quote.id
          })),

          {
            transaction,
            validate: true
          }

        );

      }

      const createdQuote = await getQuote(
        quote.id,
        transaction
      );

      return serializeQuote(createdQuote);

    });

    res.status(201).json(result);

  } catch (error) {
    handleWriteError(error, next);
  }
}

// ==========================================
// MODIFICATION D'UN BROUILLON
// PATCH /api/quotes/:id
// ==========================================

async function update(req, res, next) {

  try {

    const id = parseId(
      req.params.id,
      'Identifiant du devis'
    );

    const body = req.body;

    validateBody(
      body,
      EDITABLE_FIELDS
    );

    if (Object.keys(body).length === 0) {

      throw businessError(
        'Aucune modification fournie.'
      );

    }

    const data = sanitizeQuoteData(body);

    const result = await sequelize.transaction({

      type: Transaction.TYPES.IMMEDIATE

    }, async transaction => {

      const quote = await getQuote(
        id,
        transaction
      );

      ensureDraft(quote);

      const {
        prospect,
        client
      } = await resolveRecipient({

        prospectId: quote.prospectId,
        clientId: quote.clientId

      }, transaction);

      // Mise à jour des relations après conversion

      data.prospectId = prospect?.id ?? null;
      data.clientId = client?.id ?? null;

      const existingItems = quote.items.map(
        item => item.toJSON()
      );

      const replaceItems =
        Object.hasOwn(body, 'items');

      const items = replaceItems
        ? body.items
        : existingItems;

      const globalDiscountCents =
        Object.hasOwn(body, 'globalDiscountCents')

          ? body.globalDiscountCents

          : getGlobalDiscount(
              quote,
              existingItems
            );

      const calculation = calculateQuote(
        items,
        globalDiscountCents
      );

      await quote.update({

        ...data,
        ...calculation.totals

      }, {

        transaction

      });

      if (replaceItems) {

        await QuoteItem.destroy({

          where: {
            quoteId: quote.id
          },

          transaction

        });

        if (calculation.items.length > 0) {

          await QuoteItem.bulkCreate(

            calculation.items.map(item => ({
              ...item,
              quoteId: quote.id
            })),

            {
              transaction,
              validate: true
            }

          );

        }

      }

      const updatedQuote = await getQuote(
        quote.id,
        transaction
      );

      return serializeQuote(updatedQuote);

    });

    res.json(result);

  } catch (error) {
    handleWriteError(error, next);
  }
}

// ==========================================
// ÉMISSION DÉFINITIVE D'UN DEVIS
// POST /api/quotes/:id/issue
// ==========================================

async function issue(req, res, next) {

  try {

    const id = parseId(
      req.params.id,
      'Identifiant du devis'
    );

    // Aucune donnée d'émission ne peut être
    // imposée par le frontend.

    validateBody(
      req.body === undefined ? {} : req.body,
      []
    );

    const result = await sequelize.transaction({

      type: Transaction.TYPES.IMMEDIATE

    }, async transaction => {

      const quote = await getQuote(
        id,
        transaction
      );

      ensureDraft(quote);

      const {
        prospect,
        client
      } = await resolveRecipient({

        prospectId: quote.prospectId,
        clientId: quote.clientId

      }, transaction);

      // Vérification des informations légales

      const settings =
        await getValidatedCompanySettings(
          transaction
        );

      const issuerSnapshot =
        buildIssuerSnapshot(settings);

      // Recalcul des prestations et des montants

      const existingItems = quote.items.map(
        item => item.toJSON()
      );

      const globalDiscountCents =
        getGlobalDiscount(
          quote,
          existingItems
        );

      const calculation = calculateQuote(
        existingItems,
        globalDiscountCents
      );

      // Date d'émission et validité

      const now = new Date();

      const issueDate = getBusinessDate(now);

      const validUntil = quote.validUntil

        ? validateDate(
            quote.validUntil,
            'La date de validité'
          )

        : addDays(
            issueDate,
            settings.quoteValidityDays
          );

      // Validation complète avant numérotation

      validateQuoteForIssue(
        quote,
        calculation,
        issueDate,
        validUntil
      );

      // Attribution du numéro définitif

      const number = await generateQuoteNumber(
        transaction,
        now
      );

      // Enregistrement définitif

      await quote.update({

        ...calculation.totals,

        prospectId: prospect?.id ?? null,

        clientId: client?.id ?? null,

        number,

        status: 'Émis',

        issueDate,

        validUntil,

        issuedAt: now,

        issuerSnapshot,

        currency: settings.currency,

        taxExempt: settings.taxExempt,

        taxMention: settings.taxMention

      }, {

        transaction

      });

      const issuedQuote = await getQuote(
        quote.id,
        transaction
      );

      return serializeQuote(issuedQuote);

    });

    res.json(result);

  } catch (error) {
    handleWriteError(error, next);
  }
}

// ==========================================
// CHANGEMENT DE STATUT
// ==========================================

async function changeStatus(
  req,
  res,
  next,
  targetStatus,
  allowedFields = []
) {

  try {

    const id = parseId(
      req.params.id,
      'Identifiant du devis'
    );

    const body =
      req.body === undefined ? {} : req.body;

    validateBody(
      body,
      allowedFields
    );

    const result = await sequelize.transaction({

      type: Transaction.TYPES.IMMEDIATE

    }, async transaction => {

      await transitionQuote(
        id,
        targetStatus,
        body,
        transaction
      );

      const updatedQuote = await getQuote(
        id,
        transaction
      );

      return serializeQuote(updatedQuote);

    });

    res.json(result);

  } catch (error) {
    handleWriteError(error, next);
  }
}

// ==========================================
// ACCEPTATION D'UN DEVIS
// POST /api/quotes/:id/accept
// ==========================================

async function accept(req, res, next) {

  return changeStatus(
    req,
    res,
    next,
    'Accepté'
  );

}

// ==========================================
// REFUS D'UN DEVIS
// POST /api/quotes/:id/refuse
// ==========================================

async function refuse(req, res, next) {

  return changeStatus(
    req,
    res,
    next,
    'Refusé',
    ['reason']
  );

}

// ==========================================
// ANNULATION D'UN DEVIS
// POST /api/quotes/:id/cancel
// ==========================================

async function cancel(req, res, next) {

  return changeStatus(
    req,
    res,
    next,
    'Annulé',
    ['reason']
  );

}

// ==========================================
// EXPIRATION D'UN DEVIS
// POST /api/quotes/:id/expire
// ==========================================

async function expire(req, res, next) {

  return changeStatus(
    req,
    res,
    next,
    'Expiré'
  );

}

// ==========================================
// DUPLICATION D'UN DEVIS
// POST /api/quotes/:id/duplicate
// ==========================================

async function duplicate(req, res, next) {

  try {

    const id = parseId(
      req.params.id,
      'Identifiant du devis'
    );

    // La duplication ne permet pas de modifier
    // directement les données du devis original.

    validateBody(
      req.body === undefined ? {} : req.body,
      []
    );

    const result = await sequelize.transaction({

      type: Transaction.TYPES.IMMEDIATE

    }, async transaction => {

      // Création du nouveau brouillon

      const duplicatedQuote = await duplicateQuote(
        id,
        transaction
      );

      // Récupération avec les prestations
      // et les relations commerciales

      const quote = await getQuote(
        duplicatedQuote.id,
        transaction
      );

      return serializeQuote(quote);

    });

    res.status(201).json(result);

  } catch (error) {

    handleWriteError(error, next);

  }
}

// ==========================================
// SUPPRESSION D'UN BROUILLON
// DELETE /api/quotes/:id
// ==========================================

async function remove(req, res, next) {

  try {

    const id = parseId(
      req.params.id,
      'Identifiant du devis'
    );

    // Aucun paramètre supplémentaire autorisé

    validateBody(
      req.body === undefined ? {} : req.body,
      []
    );

    const result = await sequelize.transaction({

      type: Transaction.TYPES.IMMEDIATE

    }, async transaction => {

      return deleteDraft(
        id,
        transaction
      );

    });

    res.status(200).json(result);

  } catch (error) {

    handleWriteError(error, next);

  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  findAll,
  getStats,
  findOne,
  create,
  update,
  issue,
  accept,
  refuse,
  cancel,
  expire,
  duplicate,
  remove
};