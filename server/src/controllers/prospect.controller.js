
const { sequelize, Prospect, Interaction } = require('../models');

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
    const result = await sequelize.transaction(async transaction => {

      const prospect = await Prospect.findByPk(
        req.params.id,
        { transaction }
      );

      if (!prospect) {
        return null;
      }

      const previousStatus = prospect.status;
      const previousFollowUp = prospect.nextFollowUp;

      const changes = sanitizeData(req.body);

      await prospect.update(changes, { transaction });

      // Historique des changements de statut
      if (previousStatus !== prospect.status) {

        await Interaction.create({
          prospectId: prospect.id,
          type: 'status_change',
          subject: `${previousStatus} → ${prospect.status}`,
          content: 'Statut commercial mis à jour.'
        }, { transaction });

      }

      // Historique des dates de relance
      if (previousFollowUp !== prospect.nextFollowUp) {

        let subject;
        let content;

        if (!previousFollowUp && prospect.nextFollowUp) {

          subject = 'Relance programmée';
          content = `Nouvelle relance prévue le ${prospect.nextFollowUp}.`;

        } else if (previousFollowUp && prospect.nextFollowUp) {

          subject = 'Relance reportée';
          content = `Date modifiée : ${previousFollowUp} → ${prospect.nextFollowUp}.`;

        } else {

          subject = 'Relance retirée';
          content = `La relance prévue le ${previousFollowUp} a été retirée.`;

        }

        await Interaction.create({
          prospectId: prospect.id,
          type: 'follow_up',
          subject,
          content
        }, { transaction });

      }

      return prospect;

    });

    if (!result) {
      return res.status(404).json({
        message: 'Prospect introuvable.'
      });
    }

    res.json(result);

  } catch (error) {
    next(error);
  }
};


exports.completeFollowUp = async (req, res, next) => {
  try {
    const result = await sequelize.transaction(async transaction => {

      const prospect = await Prospect.findByPk(
        req.params.id,
        { transaction }
      );

      if (!prospect) {
        return { status: 404 };
      }

      if (!prospect.nextFollowUp) {
        return { status: 409 };
      }

      const previousStatus = prospect.status;
      const previousDate = prospect.nextFollowUp;

      const newStatus = [
        'À contacter',
        'À relancer'
      ].includes(previousStatus)
        ? 'Contacté'
        : previousStatus;

      await prospect.update({
        nextFollowUp: null,
        status: newStatus
      }, { transaction });

      await Interaction.create({
        prospectId: prospect.id,
        type: 'follow_up',
        subject: 'Relance effectuée',
        content: `Relance initialement prévue le ${previousDate}.`
      }, { transaction });

      if (previousStatus !== newStatus) {

        await Interaction.create({
          prospectId: prospect.id,
          type: 'status_change',
          subject: `${previousStatus} → ${newStatus}`,
          content: 'Statut mis à jour après une relance.'
        }, { transaction });

      }

      return {
        status: 200,
        prospect
      };

    });

    if (result.status === 404) {
      return res.status(404).json({
        message: 'Prospect introuvable.'
      });
    }

    if (result.status === 409) {
      return res.status(409).json({
        message: 'Aucune relance programmée.'
      });
    }

    res.json(result.prospect);

  } catch (error) {
    next(error);
  }
};


exports.remove = async (req, res, next) => {
  try {
    const prospect = await Prospect.findByPk(req.params.id);

    if (!prospect) {
      return res.status(404).json({
        message: 'Prospect introuvable.'
      });
    }

    await prospect.destroy();

    res.status(204).send();

  } catch (error) {
    next(error);
  }
};

