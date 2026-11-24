
const { Prospect } = require('../models');

const allowedFields = [
  'name',
  'location',
  'email',
  'phone',
  'website',
  'status',
  'notes',
  'needs',
  'creationQuote',
  'monthlySubscription',
  'firstContact',
  'nextFollowUp'
];

function sanitizeData(body) {
  const data = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(body, field)) {
      data[field] = body[field];
    }
  }

  for (const field of [
    'firstContact',
    'nextFollowUp',
    'creationQuote',
    'monthlySubscription'
  ]) {
    if (data[field] === '') {
      data[field] = null;
    }
  }

  if (typeof data.name === 'string') {
    data.name = data.name.trim();
  }

  return data;
}

// Récupérer tous les prospects
exports.findAll = async (req, res, next) => {
  try {
    const prospects = await Prospect.findAll({
      order: [['name', 'ASC']]
    });

    res.json(prospects);
  } catch (error) {
    next(error);
  }
};

// Récupérer un prospect
exports.findOne = async (req, res, next) => {
  try {
    const prospect = await Prospect.findByPk(req.params.id);

    if (!prospect) {
      return res.status(404).json({
        message: 'Prospect introuvable'
      });
    }

    res.json(prospect);
  } catch (error) {
    next(error);
  }
};

// Créer un prospect
exports.create = async (req, res, next) => {
  try {
    const data = sanitizeData(req.body);

    const prospect = await Prospect.create(data);

    res.status(201).json(prospect);
  } catch (error) {
    next(error);
  }
};

// Modifier un prospect
exports.update = async (req, res, next) => {
  try {
    const prospect = await Prospect.findByPk(req.params.id);

    if (!prospect) {
      return res.status(404).json({
        message: 'Prospect introuvable'
      });
    }

    await prospect.update(sanitizeData(req.body));

    res.json(prospect);
  } catch (error) {
    next(error);
  }
};

// Supprimer un prospect
exports.remove = async (req, res, next) => {
  try {
    const prospect = await Prospect.findByPk(req.params.id);

    if (!prospect) {
      return res.status(404).json({
        message: 'Prospect introuvable'
      });
    }

    await prospect.destroy();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
