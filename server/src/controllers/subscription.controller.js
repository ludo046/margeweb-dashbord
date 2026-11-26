const {
  sequelize,
  Subscription,
  Client
} = require('../models');

const { Op } = require('sequelize');

// ==========================================
// CONSTANTES
// ==========================================

const billingCycles = [
  'Mensuel',
  'Trimestriel',
  'Annuel'
];

const statuses = [
  'À venir',
  'Actif',
  'Suspendu',
  'Résilié'
];

const billingMonths = {
  Mensuel: 1,
  Trimestriel: 3,
  Annuel: 12
};

const editableFields = [
  'name',
  'description',
  'amount',
  'billingCycle',
  'startDate',
  'endDate',
  'nextBillingDate',
  'autoRenew',
  'notes'
];

const clientInclude = {
  model: Client,
  as: 'client',
  attributes: [
    'id',
    'name',
    'legalName',
    'email',
    'status'
  ]
};

// ==========================================
// GESTION DES ERREURS
// ==========================================

function businessError(status, message) {

  const error = new Error(message);

  error.status = status;

  return error;

}

// ==========================================
// OUTILS DE VALIDATION
// ==========================================

function isValidBody(body) {

  return (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body)
  );

}

function parseId(value) {

  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {

    throw businessError(
      400,
      'Identifiant invalide.'
    );

  }

  if (!/^[1-9]\d*$/.test(String(value))) {

    throw businessError(
      400,
      'Identifiant invalide.'
    );

  }

  const id = Number(value);

  if (!Number.isSafeInteger(id)) {

    throw businessError(
      400,
      'Identifiant invalide.'
    );

  }

  return id;

}

function today() {

  const parts = new Intl.DateTimeFormat(
    'fr-FR',
    {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  ).formatToParts(new Date());

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

function validateDate(value, label, nullable = false) {

  if (
    nullable &&
    (value === null || value === '')
  ) {

    return null;

  }

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {

    throw businessError(
      400,
      `${label} est invalide.`
    );

  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {

    throw businessError(
      400,
      `${label} est invalide.`
    );

  }

  return value;

}

function validateAmount(value) {

  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {

    throw businessError(
      400,
      'Le montant est invalide.'
    );

  }

  const normalized = String(value)
    .trim()
    .replace(',', '.');

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {

    throw businessError(
      400,
      'Le montant doit comporter au maximum deux décimales.'
    );

  }

  const amount = Number(normalized);

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 99999999.99
  ) {

    throw businessError(
      400,
      'Le montant est invalide.'
    );

  }

  return amount.toFixed(2);

}

// ==========================================
// NETTOYAGE DES DONNÉES
// ==========================================

function sanitizeData(body, creation = false) {

  if (!isValidBody(body)) {

    throw businessError(
      400,
      'Les données de l’abonnement sont invalides.'
    );

  }

  const data = {};

  const fields = creation
    ? [...editableFields, 'clientId']
    : editableFields;

  for (const field of Object.keys(body)) {

    if (!fields.includes(field)) {

      throw businessError(
        400,
        `Le champ "${field}" ne peut pas être modifié ici.`
      );

    }

  }

  for (const field of fields) {

    if (Object.hasOwn(body, field)) {

      data[field] = body[field];

    }

  }

  if (Object.hasOwn(data, 'clientId')) {

    data.clientId = parseId(data.clientId);

  }

  for (const field of [
    'name',
    'description',
    'notes'
  ]) {

    if (Object.hasOwn(data, field)) {

      if (typeof data[field] !== 'string') {

        throw businessError(
          400,
          `Le champ "${field}" est invalide.`
        );

      }

      data[field] = data[field].trim();

    }

  }

  if (Object.hasOwn(data, 'name')) {

    if (
      !data.name ||
      data.name.length > 255
    ) {

      throw businessError(
        400,
        'Le nom doit contenir entre 1 et 255 caractères.'
      );

    }

  }

  if (Object.hasOwn(data, 'amount')) {

    data.amount = validateAmount(data.amount);

  }

  if (
    Object.hasOwn(data, 'billingCycle') &&
    !billingCycles.includes(data.billingCycle)
  ) {

    throw businessError(
      400,
      'La périodicité est invalide.'
    );

  }

  if (Object.hasOwn(data, 'startDate')) {

    data.startDate = validateDate(
      data.startDate,
      'La date de début'
    );

  }

  if (Object.hasOwn(data, 'endDate')) {

    data.endDate = validateDate(
      data.endDate,
      'La date de fin',
      true
    );

  }

  if (Object.hasOwn(data, 'nextBillingDate')) {

    data.nextBillingDate = validateDate(
      data.nextBillingDate,
      'La prochaine date de facturation',
      true
    );

  }

  if (
    Object.hasOwn(data, 'autoRenew') &&
    typeof data.autoRenew !== 'boolean'
  ) {

    throw businessError(
      400,
      'Le renouvellement automatique est invalide.'
    );

  }

  return data;

}

// ==========================================
// VALIDATION MÉTIER DES DATES
// ==========================================

function validateDates(data) {

  if (
    data.endDate &&
    data.endDate < data.startDate
  ) {

    throw businessError(
      400,
      'La date de fin ne peut pas être antérieure à la date de début.'
    );

  }

  if (
    data.nextBillingDate &&
    data.nextBillingDate < data.startDate
  ) {

    throw businessError(
      400,
      'La prochaine facturation ne peut pas être antérieure à la date de début.'
    );

  }

  if (
    data.endDate &&
    data.nextBillingDate &&
    data.nextBillingDate > data.endDate
  ) {

    throw businessError(
      400,
      'La prochaine facturation ne peut pas être postérieure à la date de fin.'
    );

  }

  if (data.status === 'Actif') {

    if (data.startDate > today()) {

      throw businessError(
        409,
        'Cet abonnement n’a pas encore commencé.'
      );

    }

    if (
      data.endDate &&
      data.endDate < today()
    ) {

      throw businessError(
        409,
        'La date de fin de cet abonnement est dépassée.'
      );

    }

    if (!data.nextBillingDate) {

      throw businessError(
        400,
        'Un abonnement actif doit avoir une prochaine date de facturation.'
      );

    }

  }

}

// ==========================================
// VÉRIFICATION DU CLIENT
// ==========================================

async function getClient(
  clientId,
  transaction
) {

  const client = await Client.findByPk(
    clientId,
    { transaction }
  );

  if (!client) {

    throw businessError(
      404,
      'Client introuvable.'
    );

  }

  return client;

}

function ensureClientWritable(client) {

  if (client.status === 'Archivé') {

    throw businessError(
      409,
      'Ce client est archivé. Réactivez-le avant de gérer ses abonnements.'
    );

  }

}

// ==========================================
// RÉCUPÉRER UN ABONNEMENT
// ==========================================

async function getSubscription(
  id,
  transaction
) {

  const subscription =
    await Subscription.findByPk(
      parseId(id),
      { transaction }
    );

  if (!subscription) {

    throw businessError(
      404,
      'Abonnement introuvable.'
    );

  }

  return subscription;

}

async function reloadSubscription(
  subscription,
  transaction
) {

  return subscription.reload({

    include: [clientInclude],

    transaction

  });

}

function ensureSubscriptionWritable(
  subscription
) {

  if (subscription.status === 'Résilié') {

    throw businessError(
      409,
      'Cet abonnement est résilié. Son historique ne peut plus être modifié.'
    );

  }

}

// ==========================================
// RÉCUPÉRER TOUS LES ABONNEMENTS
// ==========================================

exports.findAll = async (req, res, next) => {

  try {

    const where = {};

    if (req.query.clientId !== undefined) {

      where.clientId = parseId(
        req.query.clientId
      );

    }

    if (req.query.status !== undefined) {

      if (!statuses.includes(req.query.status)) {

        throw businessError(
          400,
          'Le statut est invalide.'
        );

      }

      where.status = req.query.status;

    }

    if (req.query.billingCycle !== undefined) {

      if (
        !billingCycles.includes(
          req.query.billingCycle
        )
      ) {

        throw businessError(
          400,
          'La périodicité est invalide.'
        );

      }

      where.billingCycle =
        req.query.billingCycle;

    }

    const subscriptions =
      await Subscription.findAll({

        where,

        include: [clientInclude],

        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC']
        ]

      });

    res.json(subscriptions);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// RÉCUPÉRER UN ABONNEMENT PAR ID
// ==========================================

exports.findOne = async (req, res, next) => {

  try {

    const subscription =
      await Subscription.findByPk(

        parseId(req.params.id),

        {
          include: [clientInclude]
        }

      );

    if (!subscription) {

      throw businessError(
        404,
        'Abonnement introuvable.'
      );

    }

    res.json(subscription);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// CRÉER UN ABONNEMENT
// ==========================================

exports.create = async (req, res, next) => {

  try {

    const data = sanitizeData(
      req.body,
      true
    );

    for (const field of [
      'clientId',
      'name',
      'amount',
      'startDate'
    ]) {

      if (!Object.hasOwn(data, field)) {

        throw businessError(
          400,
          `Le champ "${field}" est obligatoire.`
        );

      }

    }

    const subscription =
      await sequelize.transaction(
        async transaction => {

          const client = await getClient(
            data.clientId,
            transaction
          );

          ensureClientWritable(client);

          const values = {

            ...data,

            billingCycle:
              data.billingCycle || 'Mensuel',

            status: 'À venir',

            nextBillingDate:
              data.nextBillingDate ??
              data.startDate,

            cancelledAt: null

          };

          validateDates(values);

          const created =
            await Subscription.create(
              values,
              { transaction }
            );

          return reloadSubscription(
            created,
            transaction
          );

        }
      );

    res.status(201).json(subscription);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// MODIFIER UN ABONNEMENT
// ==========================================

exports.update = async (req, res, next) => {

  try {

    const data = sanitizeData(req.body);

    if (Object.keys(data).length === 0) {

      throw businessError(
        400,
        'Aucune information à modifier.'
      );

    }

    const subscription =
      await sequelize.transaction(
        async transaction => {

          const current =
            await getSubscription(
              req.params.id,
              transaction
            );

          ensureSubscriptionWritable(
            current
          );

          const client = await getClient(
            current.clientId,
            transaction
          );

          ensureClientWritable(client);

          // La date de début est conservée
          // après activation ou suspension.

          if (
            current.status !== 'À venir' &&
            Object.hasOwn(data, 'startDate') &&
            data.startDate !== current.startDate
          ) {

            throw businessError(
              409,
              'La date de début ne peut plus être modifiée après activation.'
            );

          }

          const values = {

            ...current.get({ plain: true }),

            ...data

          };

          validateDates(values);

          await current.update(
            data,
            { transaction }
          );

          return reloadSubscription(
            current,
            transaction
          );

        }
      );

    res.json(subscription);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// ACTIVER UN ABONNEMENT
// ==========================================

exports.activate = async (req, res, next) => {

  try {

    const subscription =
      await sequelize.transaction(
        async transaction => {

          const current =
            await getSubscription(
              req.params.id,
              transaction
            );

          if (current.status !== 'À venir') {

            throw businessError(
              409,
              'Seul un abonnement à venir peut être activé.'
            );

          }

          const client = await getClient(
            current.clientId,
            transaction
          );

          ensureClientWritable(client);

          if (client.status !== 'Actif') {

            throw businessError(
              409,
              'Le client doit être actif pour activer cet abonnement.'
            );

          }

          const changes = {

            status: 'Actif',

            nextBillingDate:
              current.nextBillingDate ||
              current.startDate

          };

          validateDates({

            ...current.get({ plain: true }),

            ...changes

          });

          await current.update(
            changes,
            { transaction }
          );

          return reloadSubscription(
            current,
            transaction
          );

        }
      );

    res.json(subscription);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// SUSPENDRE UN ABONNEMENT
// ==========================================

exports.suspend = async (req, res, next) => {

  try {

    const subscription =
      await sequelize.transaction(
        async transaction => {

          const current =
            await getSubscription(
              req.params.id,
              transaction
            );

          if (current.status !== 'Actif') {

            throw businessError(
              409,
              'Seul un abonnement actif peut être suspendu.'
            );

          }

          const client = await getClient(
            current.clientId,
            transaction
          );

          ensureClientWritable(client);

          await current.update({

            status: 'Suspendu'

          }, { transaction });

          return reloadSubscription(
            current,
            transaction
          );

        }
      );

    res.json(subscription);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// REPRENDRE UN ABONNEMENT
// ==========================================

exports.resume = async (req, res, next) => {

  try {

    const subscription =
      await sequelize.transaction(
        async transaction => {

          const current =
            await getSubscription(
              req.params.id,
              transaction
            );

          if (current.status !== 'Suspendu') {

            throw businessError(
              409,
              'Seul un abonnement suspendu peut être repris.'
            );

          }

          const client = await getClient(
            current.clientId,
            transaction
          );

          ensureClientWritable(client);

          if (client.status !== 'Actif') {

            throw businessError(
              409,
              'Le client doit être actif pour reprendre cet abonnement.'
            );

          }

          const changes = {

            status: 'Actif',

            nextBillingDate:
              current.nextBillingDate ||
              current.startDate

          };

          validateDates({

            ...current.get({ plain: true }),

            ...changes

          });

          await current.update(
            changes,
            { transaction }
          );

          return reloadSubscription(
            current,
            transaction
          );

        }
      );

    res.json(subscription);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// RÉSILIER UN ABONNEMENT
// ==========================================

exports.cancel = async (req, res, next) => {

  try {

    const subscription =
      await sequelize.transaction(
        async transaction => {

          const current =
            await getSubscription(
              req.params.id,
              transaction
            );

          ensureSubscriptionWritable(
            current
          );

          const client = await getClient(
            current.clientId,
            transaction
          );

          ensureClientWritable(client);

          const cancellationDate = today();

          let endDate = current.endDate;

          // Pour un abonnement déjà commencé,
          // la résiliation prend effet aujourd'hui.
          // Une date de fin passée est conservée.

          if (
            current.startDate <= cancellationDate
          ) {

            if (
              !endDate ||
              endDate > cancellationDate
            ) {

              endDate = cancellationDate;

            }

          }

          await current.update({

            status: 'Résilié',

            endDate,

            nextBillingDate: null,

            autoRenew: false,

            cancelledAt: new Date()

          }, { transaction });

          return reloadSubscription(
            current,
            transaction
          );

        }
      );

    res.json(subscription);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// STATISTIQUES DES ABONNEMENTS
// ==========================================

exports.stats = async (req, res, next) => {

  try {

    const subscriptions =
      await Subscription.findAll({

        include: [clientInclude]

      });

    const currentDate = today();

    const result = {

      total: subscriptions.length,

      upcoming: 0,

      active: 0,

      suspended: 0,

      cancelled: 0,

      expired: 0,

      recurringSubscriptions: 0,

      overdueBilling: 0,

      upcomingBilling: 0,

      mrr: 0,

      arr: 0,

      averageMonthlyRevenue: 0,

      byBillingCycle: {

        Mensuel: 0,

        Trimestriel: 0,

        Annuel: 0

      }

    };

    // Calcul en centimes annualisés
    // pour limiter les erreurs d'arrondi.

    let annualRevenueCents = 0;

    const limitDate = new Date(
      `${currentDate}T00:00:00.000Z`
    );

    limitDate.setUTCDate(
      limitDate.getUTCDate() + 30
    );

    const next30Days = limitDate
      .toISOString()
      .slice(0, 10);

    for (const subscription of subscriptions) {

      switch (subscription.status) {

        case 'À venir':

          result.upcoming++;

          break;

        case 'Actif':

          result.active++;

          break;

        case 'Suspendu':

          result.suspended++;

          break;

        case 'Résilié':

          result.cancelled++;

          break;

      }

      const isExpired =

        subscription.status !== 'Résilié' &&

        subscription.endDate &&

        subscription.endDate < currentDate;

      if (isExpired) {

        result.expired++;

      }

      const isRecurring =

        subscription.status === 'Actif' &&

        subscription.client?.status === 'Actif' &&

        subscription.startDate <= currentDate &&

        !isExpired;

      if (!isRecurring) {

        continue;

      }

      result.recurringSubscriptions++;

      const months =
        billingMonths[subscription.billingCycle];

      const amountCents = Math.round(
        Number(subscription.amount) * 100
      );

      annualRevenueCents +=

        amountCents * (12 / months);

      result.byBillingCycle[
        subscription.billingCycle
      ]++;

      if (subscription.nextBillingDate) {

        if (
          subscription.nextBillingDate <
          currentDate
        ) {

          result.overdueBilling++;

        } else if (
          subscription.nextBillingDate <=
          next30Days
        ) {

          result.upcomingBilling++;

        }

      }

    }

    result.arr =
      annualRevenueCents / 100;

    result.mrr =
      Math.round(
        annualRevenueCents / 12
      ) / 100;

    result.averageMonthlyRevenue =

      result.recurringSubscriptions > 0

        ? Math.round(
            annualRevenueCents /
            12 /
            result.recurringSubscriptions
          ) / 100

        : 0;

    res.json(result);

  } catch (error) {

    next(error);

  }

};