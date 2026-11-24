
const { Prospect, Interaction } = require('../models');

const allowedFields = [
  'type',
  'subject',
  'content',
  'occurredAt'
];

function sanitize(body) {
  const data = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  }

  if (typeof data.subject === 'string') {
    data.subject = data.subject.trim();
  }

  return data;
}

exports.findAll = async (req, res, next) => {
  try {
    const prospect = await Prospect.findByPk(req.params.prospectId);

    if (!prospect) {
      return res.status(404).json({
        message: 'Prospect introuvable.'
      });
    }

    const interactions = await Interaction.findAll({
      where: {
        prospectId: prospect.id
      },
      order: [
        ['occurredAt', 'DESC'],
        ['id', 'DESC']
      ]
    });

    res.json(interactions);

  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const prospect = await Prospect.findByPk(req.params.prospectId);

    if (!prospect) {
      return res.status(404).json({
        message: 'Prospect introuvable.'
      });
    }

    const interaction = await Interaction.create({
      ...sanitize(req.body),
      prospectId: prospect.id
    });

    res.status(201).json(interaction);

  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const interaction = await Interaction.findOne({
      where: {
        id: req.params.id,
        prospectId: req.params.prospectId
      }
    });

    if (!interaction) {
      return res.status(404).json({
        message: 'Interaction introuvable.'
      });
    }

    await interaction.update(sanitize(req.body));

    res.json(interaction);

  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const interaction = await Interaction.findOne({
      where: {
        id: req.params.id,
        prospectId: req.params.prospectId
      }
    });

    if (!interaction) {
      return res.status(404).json({
        message: 'Interaction introuvable.'
      });
    }

    await interaction.destroy();

    res.status(204).send();

  } catch (error) {
    next(error);
  }
};
