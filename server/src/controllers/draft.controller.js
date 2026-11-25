
const { Draft, Prospect, Email } = require('../models');

const allowedFields = [
  'mode',
  'toEmail',
  'subject',
  'content',
  'prospectId',
  'originalEmailId'
];

const associations = [
  {
    model: Prospect,
    as: 'prospect',
    attributes: ['id', 'name', 'email']
  },
  {
    model: Email,
    as: 'originalEmail',
    attributes: {
      exclude: ['htmlContent']
    }
  }
];

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

      const error = new Error(
        `Le champ ${field} doit être une chaîne de caractères.`
      );

      error.status = 400;
      throw error;

    }

  }

  for (const field of ['prospectId', 'originalEmailId']) {

    if (data[field] === '') {
      data[field] = null;
    }

    if (
      data[field] !== undefined &&
      data[field] !== null &&
      (!Number.isInteger(data[field]) || data[field] <= 0)
    ) {

      const error = new Error(
        `Identifiant ${field} invalide.`
      );

      error.status = 400;
      throw error;

    }

  }

  return data;

}

async function validateRelations(data) {

  if (data.prospectId != null) {

    const prospect = await Prospect.findByPk(
      data.prospectId
    );

    if (!prospect) {

      const error = new Error('Prospect introuvable.');
      error.status = 400;
      throw error;

    }

  }

  if (data.originalEmailId != null) {

    const email = await Email.findByPk(
      data.originalEmailId
    );

    if (!email) {

      const error = new Error(
        'Message d’origine introuvable.'
      );

      error.status = 400;
      throw error;

    }

  }

}

// Liste des brouillons

exports.findAll = async (req, res, next) => {

  try {

    const drafts = await Draft.findAll({

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

// Nombre de brouillons

exports.count = async (req, res, next) => {

  try {

    const count = await Draft.count();

    res.json({ count });

  } catch (error) {

    next(error);

  }

};

// Récupérer un brouillon

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

// Créer un brouillon

exports.create = async (req, res, next) => {

  try {

    const data = sanitizeData(req.body);

    await validateRelations(data);

    const draft = await Draft.create(data);

    await draft.reload({
      include: associations
    });

    res.status(201).json(draft);

  } catch (error) {

    next(error);

  }

};

// Modifier un brouillon

exports.update = async (req, res, next) => {

  try {

    const draft = await Draft.findByPk(
      req.params.id
    );

    if (!draft) {

      return res.status(404).json({
        message: 'Brouillon introuvable.'
      });

    }

    const data = sanitizeData(req.body);

    await validateRelations(data);

    await draft.update(data);

    await draft.reload({
      include: associations
    });

    res.json(draft);

  } catch (error) {

    next(error);

  }

};

// Supprimer un brouillon

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
