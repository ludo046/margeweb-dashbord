const {
  sequelize,
  Prospect,
  Client,
  Interaction
} = require('../models');

// ==========================================
// CONFIGURATION
// ==========================================

const allowedFields = [
  'type',
  'subject',
  'content',
  'occurredAt'
];

const manualTypes = [
  'note',
  'call',
  'meeting'
];

// ==========================================
// VALIDATION
// ==========================================

function validationError(message, status = 400) {

  const error = new Error(message);

  error.status = status;

  return error;

}

function sanitize(body = {}) {

  const data = {};

  for (const field of allowedFields) {

    if (Object.prototype.hasOwnProperty.call(body, field)) {

      data[field] = body[field];

    }

  }

  if (typeof data.subject === 'string') {

    data.subject = data.subject.trim();

  }

  if (
    data.subject !== undefined &&
    (
      typeof data.subject !== 'string' ||
      !data.subject ||
      data.subject.length > 255
    )
  ) {

    throw validationError(
      'Le sujet de l’interaction est invalide.'
    );

  }

  if (
    data.content !== undefined &&
    typeof data.content !== 'string'
  ) {

    throw validationError(
      'Le contenu de l’interaction est invalide.'
    );

  }

  if (
    data.occurredAt !== undefined &&
    (
      typeof data.occurredAt !== 'string' ||
      Number.isNaN(Date.parse(data.occurredAt))
    )
  ) {

    throw validationError(
      'La date de l’interaction est invalide.'
    );

  }

  return data;

}

// ==========================================
// IDENTIFICATION DU PROPRIÉTAIRE
// ==========================================

async function resolveOwner(req, transaction) {

  // Interaction depuis une fiche client

  if (req.params.clientId !== undefined) {

    const client = await Client.findByPk(

      req.params.clientId,

      { transaction }

    );

    if (!client) {

      throw validationError(
        'Client introuvable.',
        404
      );

    }

    return {

      kind: 'client',

      record: client,

      where: {
        clientId: client.id
      },

      relations: {
        clientId: client.id,
        prospectId: client.prospectId ?? null
      }

    };

  }

  // Interaction depuis une fiche prospect

  if (req.params.prospectId !== undefined) {

    const prospect = await Prospect.findByPk(

      req.params.prospectId,

      { transaction }

    );

    if (!prospect) {

      throw validationError(
        'Prospect introuvable.',
        404
      );

    }

    const linkedClient = await Client.findOne({

      where: {
        prospectId: prospect.id
      },

      transaction

    });

    return {

      kind: 'prospect',

      record: prospect,

      linkedClient,

      where: {
        prospectId: prospect.id
      },

      relations: {
        prospectId: prospect.id,
        clientId: linkedClient?.id ?? null
      }

    };

  }

  throw validationError(
    'Propriétaire de l’interaction introuvable.'
  );

}

// ==========================================
// PROTECTION DE L'HISTORIQUE
// ==========================================

function ensureOwnerWritable(owner) {

  if (
    owner.kind === 'prospect' &&
    owner.linkedClient
  ) {

    throw validationError(

      'Ce prospect est devenu client. Utilise sa fiche client.',

      409

    );

  }

  if (
    owner.kind === 'client' &&
    owner.record.status === 'Archivé'
  ) {

    throw validationError(

      'Ce client est archivé. Réactive-le pour modifier son historique.',

      409

    );

  }

}

function isConversionNote(interaction) {

  return (
    interaction.type === 'note' &&
    interaction.subject === 'Conversion en client' &&
    interaction.clientId != null &&
    interaction.prospectId != null
  );

}

function ensureInteractionEditable(interaction) {

  if (
    !manualTypes.includes(interaction.type) ||
    isConversionNote(interaction)
  ) {

    throw validationError(

      'Cette interaction automatique ne peut pas être modifiée ou supprimée.',

      409

    );

  }

}

function validateManualType(type, owner) {

  const types = [...manualTypes];

  if (owner.kind === 'prospect') {

    types.push('follow_up');

  }

  if (!types.includes(type)) {

    throw validationError(
      'Ce type d’interaction ne peut pas être créé manuellement.'
    );

  }

}

// ==========================================
// LISTE DES INTERACTIONS
// ==========================================

exports.findAll = async (req, res, next) => {

  try {

    const owner = await resolveOwner(req);

    const interactions = await Interaction.findAll({

      where: owner.where,

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

// ==========================================
// CRÉER UNE INTERACTION
// ==========================================

exports.create = async (req, res, next) => {

  try {

    const interaction = await sequelize.transaction(

      async transaction => {

        const owner = await resolveOwner(
          req,
          transaction
        );

        ensureOwnerWritable(owner);

        const data = sanitize(req.body);

        validateManualType(
          data.type,
          owner
        );

        if (!data.subject) {

          throw validationError(
            'Le sujet est obligatoire.'
          );

        }

        const candidate = {
          ...data,
          ...owner.relations
        };

        if (isConversionNote(candidate)) {

          throw validationError(
            'Ce sujet est réservé à la conversion automatique.'
          );

        }

        return Interaction.create(

          candidate,

          { transaction }

        );

      }

    );

    res.status(201).json(interaction);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// MODIFIER UNE INTERACTION
// ==========================================

exports.update = async (req, res, next) => {

  try {

    const result = await sequelize.transaction(

      async transaction => {

        const owner = await resolveOwner(
          req,
          transaction
        );

        ensureOwnerWritable(owner);

        const interaction = await Interaction.findOne({

          where: {

            id: req.params.id,

            ...owner.where

          },

          transaction

        });

        if (!interaction) {

          throw validationError(
            'Interaction introuvable.',
            404
          );

        }

        ensureInteractionEditable(interaction);

        const data = sanitize(req.body);

        if (
          data.type !== undefined &&
          !manualTypes.includes(data.type)
        ) {

          throw validationError(
            'Le nouveau type d’interaction est invalide.'
          );

        }

        const candidate = {

          ...interaction.get({ plain: true }),

          ...data

        };

        if (isConversionNote(candidate)) {

          throw validationError(
            'Ce sujet est réservé à la conversion automatique.'
          );

        }

        await interaction.update(

          data,

          { transaction }

        );

        return interaction;

      }

    );

    res.json(result);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// SUPPRIMER UNE INTERACTION
// ==========================================

exports.remove = async (req, res, next) => {

  try {

    await sequelize.transaction(

      async transaction => {

        const owner = await resolveOwner(
          req,
          transaction
        );

        ensureOwnerWritable(owner);

        const interaction = await Interaction.findOne({

          where: {

            id: req.params.id,

            ...owner.where

          },

          transaction

        });

        if (!interaction) {

          throw validationError(
            'Interaction introuvable.',
            404
          );

        }

        ensureInteractionEditable(interaction);

        await interaction.destroy({
          transaction
        });

      }

    );

    res.status(204).send();

  } catch (error) {

    next(error);

  }

};