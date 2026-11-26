const {
  sequelize,
  Client,
  Prospect,
  Interaction,
  Email,
  Draft,
  Subscription
} = require('../models');

const { Op } = require('sequelize');

const allowedFields = [
  'name',
  'legalName',
  'contactName',
  'email',
  'phone',
  'website',
  'address',
  'postalCode',
  'city',
  'country',
  'siret',
  'status',
  'clientSince',
  'notes'
];

const editableStatuses = [
  'Actif',
  'Inactif'
];

// Nettoyage des données

function sanitizeData(body = {}) {

  const data = {};

  for (const field of allowedFields) {

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        field
      )
    ) {

      data[field] =
        typeof body[field] === 'string'
          ? body[field].trim()
          : body[field];

    }

  }

  return data;

}

// Vérification du corps de la requête

function isValidBody(body) {

  return (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body)
  );

}

// Vérification du nom

function isValidName(name) {

  return (
    typeof name === 'string' &&
    name.trim().length > 0
  );

}

// ==========================================
// PROTECTION DES ABONNEMENTS
// ==========================================

// Compter les abonnements actifs

async function countActiveSubscriptions(
  clientId,
  transaction
) {

  return Subscription.count({

    where: {

      clientId,

      status: 'Actif'

    },

    transaction

  });

}

// Compter les abonnements non résiliés

async function countOpenSubscriptions(
  clientId,
  transaction
) {

  return Subscription.count({

    where: {

      clientId,

      status: {

        [Op.in]: [
          'À venir',
          'Actif',
          'Suspendu'
        ]

      }

    },

    transaction

  });

}

// Récupérer tous les clients

exports.findAll = async (req, res, next) => {

  try {

    const clients = await Client.findAll({
      order: [['name', 'ASC']]
    });

    res.json(clients);

  } catch (error) {

    next(error);

  }

};

// Récupérer un client

exports.findOne = async (req, res, next) => {

  try {

    const client = await Client.findByPk(
      req.params.id,
      {
        include: [
          {
            model: Prospect,
            as: 'prospect'
          }
        ]
      }
    );

    if (!client) {

      return res.status(404).json({
        message: 'Client introuvable.'
      });

    }

    res.json(client);

  } catch (error) {

    next(error);

  }

};

// Créer un client manuellement

exports.create = async (req, res, next) => {

  try {

    if (!isValidBody(req.body)) {

      return res.status(400).json({
        message: 'Les données du client sont invalides.'
      });

    }

    const data = sanitizeData(req.body);

    if (!isValidName(data.name)) {

      return res.status(400).json({
        message: 'Le nom du client est obligatoire.'
      });

    }

    if (
      Object.prototype.hasOwnProperty.call(
        data,
        'status'
      ) &&
      !editableStatuses.includes(data.status)
    ) {

      return res.status(400).json({
        message:
          'Un nouveau client doit être actif ou inactif.'
      });

    }

    const client = await Client.create(data);

    res.status(201).json(client);

  } catch (error) {

    next(error);

  }

};

// Modifier ou réactiver un client

exports.update = async (req, res, next) => {

  try {

    if (!isValidBody(req.body)) {

      return res.status(400).json({
        message: 'Les données du client sont invalides.'
      });

    }

    const data = sanitizeData(req.body);

    const result = await sequelize.transaction(
      async (transaction) => {

        const client = await Client.findByPk(
          req.params.id,
          { transaction }
        );

        if (!client) {

          return {
            status: 404,
            message: 'Client introuvable.'
          };

        }

        // Client archivé :
        // seule la réactivation est autorisée

        if (client.status === 'Archivé') {

          const fields = Object.keys(req.body);

          const isReactivation =
            fields.length === 1 &&
            fields[0] === 'status' &&
            data.status === 'Actif';

          if (!isReactivation) {

            return {
              status: 409,
              message:
                'Ce client est archivé. Réactivez-le avant de modifier ses informations.'
            };

          }

          await client.update(
            {
              status: 'Actif'
            },
            { transaction }
          );

          return {
            status: 200,
            client
          };

        }

        // Vérifier les données à modifier

        if (Object.keys(data).length === 0) {

          return {
            status: 400,
            message:
              'Aucune information à modifier.'
          };

        }

        // Vérifier le nom si celui-ci est modifié

        if (
          Object.prototype.hasOwnProperty.call(
            data,
            'name'
          ) &&
          !isValidName(data.name)
        ) {

          return {
            status: 400,
            message:
              'Le nom du client est obligatoire.'
          };

        }

        // L'archivage doit passer par la route dédiée

        if (data.status === 'Archivé') {

          return {
            status: 409,
            message:
              'Utilisez la procédure d’archivage pour archiver ce client.'
          };

        }

        // Vérifier les statuts autorisés

        if (
          Object.prototype.hasOwnProperty.call(
            data,
            'status'
          ) &&
          !editableStatuses.includes(data.status)
        ) {

          return {
            status: 400,
            message: 'Le statut du client est invalide.'
          };

        }

        // Empêcher la désactivation d'un client
        // possédant des abonnements actifs

        if (data.status === 'Inactif') {

          const activeSubscriptions =
            await countActiveSubscriptions(
              client.id,
              transaction
            );

          if (activeSubscriptions > 0) {

            return {

              status: 409,

              message:
                `Ce client possède ${activeSubscriptions} abonnement(s) actif(s). Suspendez ou résiliez ses abonnements avant de le désactiver.`

            };

          }

        }

        // Enregistrer les modifications

        await client.update(
          data,
          { transaction }
        );

        return {
          status: 200,
          client
        };

      }
    );

    if (result.status !== 200) {

      return res.status(result.status).json({
        message: result.message
      });

    }

    res.json(result.client);

  } catch (error) {

    next(error);

  }

};

// Archiver un client

exports.archive = async (req, res, next) => {

  try {

    const result = await sequelize.transaction(
      async (transaction) => {

        const client = await Client.findByPk(
          req.params.id,
          { transaction }
        );

        if (!client) {

          return {
            status: 404,
            message: 'Client introuvable.'
          };

        }

        // Empêcher un double archivage

        if (client.status === 'Archivé') {

          return {
            status: 409,
            message: 'Ce client est déjà archivé.'
          };

        }

        // Empêcher l'archivage d'un client
        // possédant des abonnements non résiliés

        const openSubscriptions =
          await countOpenSubscriptions(
            client.id,
            transaction
          );

        if (openSubscriptions > 0) {

          return {

            status: 409,

            message:
              `Ce client possède ${openSubscriptions} abonnement(s) non résilié(s). Résiliez ses abonnements avant de l’archiver.`

          };

        }

        // Archivage sans suppression des données

        await client.update(
          {
            status: 'Archivé'
          },
          { transaction }
        );

        return {
          status: 200,
          client
        };

      }
    );

    if (result.status !== 200) {

      return res.status(result.status).json({
        message: result.message
      });

    }

    res.json(result.client);

  } catch (error) {

    next(error);

  }

};

// Convertir un prospect en client

exports.convertProspect = async (req, res, next) => {

  try {

    const result = await sequelize.transaction(
      async (transaction) => {

        // 1. Récupérer le prospect

        const prospect = await Prospect.findByPk(
          req.params.prospectId,
          { transaction }
        );

        if (!prospect) {

          return {
            status: 404,
            message: 'Prospect introuvable.'
          };

        }

        // 2. Vérifier qu'il n'est pas déjà client

        const existingClient = await Client.findOne({

          where: {
            prospectId: prospect.id
          },

          transaction

        });

        if (existingClient) {

          return {
            status: 409,
            message: 'Ce prospect est déjà un client.',
            client: existingClient
          };

        }

        // 3. Créer la fiche client

        const client = await Client.create({

          prospectId: prospect.id,
          name: prospect.name,
          email: prospect.email || '',
          phone: prospect.phone || '',
          website: prospect.website || '',
          city: prospect.location || '',
          notes: prospect.notes || '',
          status: 'Actif'

        }, { transaction });

        // 4. Rattacher les emails existants

        const [emailsCount] = await Email.update({

          clientId: client.id

        }, {

          where: {
            prospectId: prospect.id,
            clientId: null
          },

          silent: true,
          transaction

        });

        // 5. Rattacher les brouillons existants

        const [draftsCount] = await Draft.update({

          clientId: client.id

        }, {

          where: {
            prospectId: prospect.id,
            clientId: null
          },

          silent: true,
          transaction

        });

        // Adapter les brouillons de prospection
        // sans modifier les réponses et transferts

        await Draft.update({

          mode: 'client'

        }, {

          where: {
            prospectId: prospect.id,
            clientId: client.id,
            mode: 'prospect'
          },

          silent: true,
          transaction

        });

        // 6. Rattacher les interactions existantes

        const [interactionsCount] = await Interaction.update({

          clientId: client.id

        }, {

          where: {
            prospectId: prospect.id,
            clientId: null
          },

          silent: true,
          transaction

        });

        // 7. Mettre à jour le prospect

        const previousStatus = prospect.status;

        await prospect.update({

          status: 'Client',
          nextFollowUp: null

        }, { transaction });

        // 8. Enregistrer la conversion

        await Interaction.create({

          prospectId: prospect.id,
          clientId: client.id,
          type: 'note',
          subject: 'Conversion en client',
          content: 'Le prospect a été converti en client.'

        }, { transaction });

        // 9. Enregistrer le changement de statut

        if (previousStatus !== 'Client') {

          await Interaction.create({

            prospectId: prospect.id,
            clientId: client.id,
            type: 'status_change',
            subject: 'Changement de statut',
            content: `${previousStatus} → Client`

          }, { transaction });

        }

        // 10. Retourner le résultat

        return {

          status: 201,

          client,

          transferred: {
            emails: emailsCount,
            drafts: draftsCount,
            interactions: interactionsCount
          }

        };

      }
    );

    res.status(result.status).json(result);

  } catch (error) {

    if (error.name === 'SequelizeUniqueConstraintError') {

      return res.status(409).json({
        message:
          'Ce prospect est déjà associé à un client.'
      });

    }

    next(error);

  }

};