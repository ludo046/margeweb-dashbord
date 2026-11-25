const {
  sequelize,
  Prospect,
  Interaction,
  Client
} = require('../models');

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
        message: 'Prospect introuvable.'
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

    if (data.status === 'Client') {
      return res.status(409).json({
        message:
          'Un prospect doit être converti pour devenir client.'
      });
    }

    const prospect = await Prospect.create(data);

    res.status(201).json(prospect);

  } catch (error) {
    next(error);
  }
};

// Modifier un prospect

exports.update = async (req, res, next) => {
  try {

    const result = await sequelize.transaction(
      async transaction => {

        const prospect = await Prospect.findByPk(
          req.params.id,
          { transaction }
        );

        if (!prospect) {
          return {
            status: 404,
            message: 'Prospect introuvable.'
          };
        }

        const linkedClient = await Client.findOne({
          where: {
            prospectId: prospect.id
          },
          transaction
        });

        const previousStatus = prospect.status;
        const previousFollowUp = prospect.nextFollowUp;

        const changes = sanitizeData(req.body);

        // Protection des prospects convertis

        if (linkedClient) {

          if (
            Object.hasOwn(changes, 'status') &&
            changes.status !== 'Client'
          ) {
            return {
              status: 409,
              message:
                'Ce prospect est associé à un client. Son statut commercial ne peut plus être modifié.'
            };
          }

          if (changes.nextFollowUp) {
            return {
              status: 409,
              message:
                'Une relance de prospection ne peut pas être programmée pour un client.'
            };
          }

        } else {

          // Interdire le passage manuel au statut Client

          if (
            changes.status === 'Client' &&
            previousStatus !== 'Client'
          ) {
            return {
              status: 409,
              message:
                'Utilise la conversion en client pour modifier ce statut.'
            };
          }

        }

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

            content =
              `Nouvelle relance prévue le ${prospect.nextFollowUp}.`;

          } else if (
            previousFollowUp &&
            prospect.nextFollowUp
          ) {

            subject = 'Relance reportée';

            content =
              `Date modifiée : ${previousFollowUp} → ${prospect.nextFollowUp}.`;

          } else {

            subject = 'Relance retirée';

            content =
              `La relance prévue le ${previousFollowUp} a été retirée.`;

          }

          await Interaction.create({
            prospectId: prospect.id,
            type: 'follow_up',
            subject,
            content
          }, { transaction });

        }

        return {
          status: 200,
          prospect
        };

      }
    );

    if (result.status !== 200) {
      return res.status(result.status).json({
        message: result.message
      });
    }

    res.json(result.prospect);

  } catch (error) {
    next(error);
  }
};

// Terminer une relance

exports.completeFollowUp = async (req, res, next) => {
  try {

    const result = await sequelize.transaction(
      async transaction => {

        const prospect = await Prospect.findByPk(
          req.params.id,
          { transaction }
        );

        if (!prospect) {
          return {
            status: 404,
            message: 'Prospect introuvable.'
          };
        }

        const linkedClient = await Client.findOne({
          where: {
            prospectId: prospect.id
          },
          transaction
        });

        if (linkedClient) {
          return {
            status: 409,
            message:
              'Ce prospect est déjà associé à un client.'
          };
        }

        if (!prospect.nextFollowUp) {
          return {
            status: 409,
            message: 'Aucune relance programmée.'
          };
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
          content:
            `Relance initialement prévue le ${previousDate}.`
        }, { transaction });

        if (previousStatus !== newStatus) {

          await Interaction.create({
            prospectId: prospect.id,
            type: 'status_change',
            subject: `${previousStatus} → ${newStatus}`,
            content:
              'Statut mis à jour après une relance.'
          }, { transaction });

        }

        return {
          status: 200,
          prospect
        };

      }
    );

    if (result.status !== 200) {
      return res.status(result.status).json({
        message: result.message
      });
    }

    res.json(result.prospect);

  } catch (error) {
    next(error);
  }
};

// Supprimer un prospect

exports.remove = async (req, res, next) => {
  try {

    const result = await sequelize.transaction(
      async transaction => {

        const prospect = await Prospect.findByPk(
          req.params.id,
          { transaction }
        );

        if (!prospect) {
          return {
            status: 404,
            message: 'Prospect introuvable.'
          };
        }

        const linkedClient = await Client.findOne({
          where: {
            prospectId: prospect.id
          },
          transaction
        });

        if (linkedClient) {
          return {
            status: 409,
            message:
              'Impossible de supprimer ce prospect : il est associé à un client. Son historique doit être conservé.'
          };
        }

        await prospect.destroy({ transaction });

        return {
          status: 204
        };

      }
    );

    if (result.status !== 204) {
      return res.status(result.status).json({
        message: result.message
      });
    }

    res.status(204).send();

  } catch (error) {
    next(error);
  }
};