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

// ==========================================
// VALIDATION ET NETTOYAGE
// ==========================================

function isValidBody(body) {

  return (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body)
  );

}

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

// ==========================================
// RÉCUPÉRER TOUS LES PROSPECTS
// ==========================================

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

// ==========================================
// RÉCUPÉRER UN PROSPECT
// ==========================================

exports.findOne = async (req, res, next) => {

  try {

    const prospect = await Prospect.findByPk(

      req.params.id

    );

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

// ==========================================
// CRÉER UN PROSPECT
// ==========================================

exports.create = async (req, res, next) => {

  try {

    if (!isValidBody(req.body)) {

      return res.status(400).json({

        message: 'Les données du prospect sont invalides.'

      });

    }

    const data = sanitizeData(req.body);

    if (
      typeof data.name !== 'string' ||
      !data.name.trim()
    ) {

      return res.status(400).json({

        message: 'Le nom du prospect est obligatoire.'

      });

    }

    // Interdire la création directe au statut Client

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

// ==========================================
// MODIFIER UN PROSPECT
// ==========================================

exports.update = async (req, res, next) => {

  try {

    if (!isValidBody(req.body)) {

      return res.status(400).json({

        message: 'Les données du prospect sont invalides.'

      });

    }

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

        // ====================================
        // PROTECTION DES PROSPECTS CONVERTIS
        // ====================================

        // Dès qu'un client est associé au prospect,
        // aucune modification n'est autorisée.
        //
        // La fiche prospect devient une archive
        // de la relation commerciale initiale.

        if (linkedClient) {

          return {

            status: 409,

            message:
              'Ce prospect a été converti en client. Sa fiche est désormais en lecture seule. Utilise la fiche client pour modifier ses informations.',

            clientId: linkedClient.id

          };

        }

        const previousStatus = prospect.status;

        const previousFollowUp = prospect.nextFollowUp;

        const changes = sanitizeData(req.body);

        // Vérifier qu'au moins un champ est modifiable

        if (Object.keys(changes).length === 0) {

          return {

            status: 400,

            message:
              'Aucune information modifiable n’a été fournie.'

          };

        }

        // Vérifier le nom si celui-ci est modifié

        if (
          Object.hasOwn(changes, 'name') &&
          (
            typeof changes.name !== 'string' ||
            !changes.name.trim()
          )
        ) {

          return {

            status: 400,

            message:
              'Le nom du prospect est obligatoire.'

          };

        }

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

        await prospect.update(

          changes,

          { transaction }

        );

        // ====================================
        // HISTORIQUE DES CHANGEMENTS DE STATUT
        // ====================================

        if (previousStatus !== prospect.status) {

          await Interaction.create({

            prospectId: prospect.id,

            type: 'status_change',

            subject:
              `${previousStatus} → ${prospect.status}`,

            content:
              'Statut commercial mis à jour.'

          }, { transaction });

        }

        // ====================================
        // HISTORIQUE DES DATES DE RELANCE
        // ====================================

        const previousFollowUpTime = previousFollowUp

          ? new Date(previousFollowUp).getTime()

          : null;

        const currentFollowUpTime = prospect.nextFollowUp

          ? new Date(prospect.nextFollowUp).getTime()

          : null;

        if (
          previousFollowUpTime !== currentFollowUpTime
        ) {

          let subject;

          let content;

          if (
            !previousFollowUp &&
            prospect.nextFollowUp
          ) {

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

        message: result.message,

        ...(result.clientId != null
          ? { clientId: result.clientId }
          : {})

      });

    }

    res.json(result.prospect);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// TERMINER UNE RELANCE
// ==========================================

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

        // Interdire les relances de prospection
        // après la conversion en client

        if (linkedClient) {

          return {

            status: 409,

            message:
              'Ce prospect a été converti en client. Les relances de prospection ne sont plus disponibles.',

            clientId: linkedClient.id

          };

        }

        if (!prospect.nextFollowUp) {

          return {

            status: 409,

            message:
              'Aucune relance programmée.'

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

            subject:
              `${previousStatus} → ${newStatus}`,

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

        message: result.message,

        ...(result.clientId != null
          ? { clientId: result.clientId }
          : {})

      });

    }

    res.json(result.prospect);

  } catch (error) {

    next(error);

  }

};

// ==========================================
// SUPPRIMER UN PROSPECT
// ==========================================

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

        // Conserver définitivement le prospect
        // d'origine lorsqu'un client lui est associé

        if (linkedClient) {

          return {

            status: 409,

            message:
              'Impossible de supprimer ce prospect : il a été converti en client. Son historique commercial doit être conservé.',

            clientId: linkedClient.id

          };

        }

        await prospect.destroy({

          transaction

        });

        return {

          status: 204

        };

      }

    );

    if (result.status !== 204) {

      return res.status(result.status).json({

        message: result.message,

        ...(result.clientId != null
          ? { clientId: result.clientId }
          : {})

      });

    }

    res.status(204).send();

  } catch (error) {

    next(error);

  }

};