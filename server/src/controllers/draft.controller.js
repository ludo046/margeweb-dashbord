const {
  sequelize,
  Draft,
  Prospect,
  Client,
  Email
} = require('../models');

const allowedFields = [
  'mode',
  'toEmail',
  'subject',
  'content',
  'prospectId',
  'clientId',
  'originalEmailId'
];

const allowedModes = [
  'new',
  'prospect',
  'client',
  'reply',
  'forward'
];

const associations = [
  {
    model: Prospect,
    as: 'prospect',
    attributes: ['id', 'name', 'email']
  },
  {
    model: Client,
    as: 'client',
    attributes: ['id', 'name', 'email', 'status']
  },
  {
    model: Email,
    as: 'originalEmail',
    attributes: {
      exclude: ['htmlContent']
    }
  }
];

// ==========================================
// VALIDATION
// ==========================================

function validationError(message) {

  const error = new Error(message);

  error.status = 400;

  return error;

}

function sanitizeData(body = {}) {

  const data = {};

  for (const field of allowedFields) {

    if (Object.prototype.hasOwnProperty.call(body, field)) {

      data[field] = body[field];

    }

  }

  for (const field of ['toEmail', 'subject', 'content']) {

    if (
      Object.prototype.hasOwnProperty.call(data, field) &&
      typeof data[field] !== 'string'
    ) {

      throw validationError(
        `Le champ ${field} doit être une chaîne de caractères.`
      );

    }

  }

  for (const field of [
    'prospectId',
    'clientId',
    'originalEmailId'
  ]) {

    if (data[field] === '') {

      data[field] = null;

    }

    if (
      data[field] !== undefined &&
      data[field] !== null &&
      (
        !Number.isSafeInteger(data[field]) ||
        data[field] <= 0
      )
    ) {

      throw validationError(
        `Identifiant ${field} invalide.`
      );

    }

  }

  if (
    data.mode !== undefined &&
    !allowedModes.includes(data.mode)
  ) {

    throw validationError(
      'Mode de rédaction invalide.'
    );

  }

  return data;

}

// ==========================================
// VALIDATION DES RELATIONS
// ==========================================

async function validateRelations(data, transaction) {

  let prospect = null;
  let client = null;
  let originalEmail = null;

  // Vérifier le prospect

  if (data.prospectId != null) {

    prospect = await Prospect.findByPk(
      data.prospectId,
      { transaction }
    );

    if (!prospect) {

      throw validationError(
        'Prospect introuvable.'
      );

    }

  }

  // Vérifier le client

  if (data.clientId != null) {

    client = await Client.findByPk(
      data.clientId,
      { transaction }
    );

    if (!client) {

      throw validationError(
        'Client introuvable.'
      );

    }

  }

  // Vérifier le message d'origine

  if (data.originalEmailId != null) {

    originalEmail = await Email.findByPk(
      data.originalEmailId,
      { transaction }
    );

    if (!originalEmail) {

      throw validationError(
        'Message d’origine introuvable.'
      );

    }

  }

  // Hériter des associations du message d'origine
  // lors d'une réponse ou d'un transfert

  if (
    originalEmail &&
    ['reply', 'forward'].includes(data.mode)
  ) {

    if (
      data.prospectId != null &&
      originalEmail.prospectId != null &&
      data.prospectId !== originalEmail.prospectId
    ) {

      throw validationError(
        'Le prospect ne correspond pas au message d’origine.'
      );

    }

    if (
      data.clientId != null &&
      originalEmail.clientId != null &&
      data.clientId !== originalEmail.clientId
    ) {

      throw validationError(
        'Le client ne correspond pas au message d’origine.'
      );

    }

    data.prospectId =
      data.prospectId ??
      originalEmail.prospectId ??
      null;

    data.clientId =
      data.clientId ??
      originalEmail.clientId ??
      null;

  }

  // Rechercher un éventuel client issu du prospect

  if (
    data.prospectId != null &&
    data.clientId == null
  ) {

    const linkedClient = await Client.findOne({

      where: {
        prospectId: data.prospectId
      },

      transaction

    });

    if (linkedClient) {

      data.clientId = linkedClient.id;

    }

  }

  // Compléter la relation avec le prospect d'origine

  if (data.clientId != null) {

    client = await Client.findByPk(
      data.clientId,
      { transaction }
    );

    if (!client) {

      throw validationError(
        'Client introuvable.'
      );

    }

    if (
      data.prospectId != null &&
      data.prospectId !== client.prospectId
    ) {

      throw validationError(
        'Ce prospect ne correspond pas au client sélectionné.'
      );

    }

    data.prospectId =
      client.prospectId ?? null;

  }

  // Un prospect converti devient un client

  if (
    data.mode === 'prospect' &&
    data.clientId != null
  ) {

    data.mode = 'client';

  }

  // Vérifier la cohérence du mode

  if (
    data.mode === 'client' &&
    data.clientId == null
  ) {

    throw validationError(
      'Un client doit être sélectionné.'
    );

  }

  if (
    data.mode === 'prospect' &&
    data.prospectId == null
  ) {

    throw validationError(
      'Un prospect doit être sélectionné.'
    );

  }

  if (
    ['reply', 'forward'].includes(data.mode) &&
    data.originalEmailId == null
  ) {

    throw validationError(
      'Le message d’origine est obligatoire.'
    );

  }

  return data;

}

// ==========================================
// LISTE DES BROUILLONS
// ==========================================

exports.findAll = async (req, res, next) => {

  try {

    const where = {};

    for (const field of ['clientId', 'prospectId']) {

      if (req.query[field] !== undefined) {

        const id = Number(req.query[field]);

        if (
          !Number.isSafeInteger(id) ||
          id <= 0
        ) {

          throw validationError(
            `Identifiant ${field} invalide.`
          );

        }

        where[field] = id;

      }

    }

    const drafts = await Draft.findAll({

      where,

      include: associations,

      order: [
        ['updatedAt', 'DESC'],
        ['id', 'DESC']
      ]

    });

    res.json(drafts);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// NOMBRE DE BROUILLONS
// ==========================================

exports.count = async (req, res, next) => {

  try {

    const count = await Draft.count();

    res.json({ count });

  } catch (error) {

    next(error);

  }

};

// ==========================================
// RÉCUPÉRER UN BROUILLON
// ==========================================

exports.findOne = async (req, res, next) => {

  try {

    const draft = await Draft.findByPk(
      req.params.id,
      {
        include: associations
      }
    );

    if (!draft) {

      return res.status(404).json({
        message: 'Brouillon introuvable.'
      });

    }

    res.json(draft);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// CRÉER UN BROUILLON
// ==========================================

exports.create = async (req, res, next) => {

  try {

    const draft = await sequelize.transaction(
      async transaction => {

        const data = {

          mode: 'new',
          prospectId: null,
          clientId: null,
          originalEmailId: null,

          ...sanitizeData(req.body)

        };

        await validateRelations(
          data,
          transaction
        );

        const createdDraft = await Draft.create(
          data,
          { transaction }
        );

        await createdDraft.reload({

          include: associations,
          transaction

        });

        return createdDraft;

      }
    );

    res.status(201).json(draft);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// MODIFIER UN BROUILLON
// ==========================================

exports.update = async (req, res, next) => {

  try {

    const result = await sequelize.transaction(
      async transaction => {

        const draft = await Draft.findByPk(

          req.params.id,

          { transaction }

        );

        if (!draft) {

          return null;

        }

        const changes = sanitizeData(req.body);

        // Fusionner les données existantes
        // avec les nouvelles modifications

        const data = {};

        for (const field of allowedFields) {

          data[field] = draft.get(field);

        }

        Object.assign(data, changes);

        await validateRelations(
          data,
          transaction
        );

        await draft.update(
          data,
          { transaction }
        );

        await draft.reload({

          include: associations,
          transaction

        });

        return draft;

      }
    );

    if (!result) {

      return res.status(404).json({
        message: 'Brouillon introuvable.'
      });

    }

    res.json(result);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// SUPPRIMER UN BROUILLON
// ==========================================

exports.remove = async (req, res, next) => {

  try {

    const draft = await Draft.findByPk(
      req.params.id
    );

    if (!draft) {

      return res.status(404).json({
        message: 'Brouillon introuvable.'
      });

    }

    await draft.destroy();

    res.status(204).send();

  } catch (error) {

    next(error);

  }

};