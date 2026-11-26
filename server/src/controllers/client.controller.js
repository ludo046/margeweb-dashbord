const {
  sequelize,
  Client,
  Prospect,
  Interaction,
  Email,
  Draft
} = require('../models');

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

function sanitizeData(body = {}) {
  const data = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = typeof body[field] === 'string'
        ? body[field].trim()
        : body[field];
    }
  }

  return data;
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
    const client = await Client.findByPk(req.params.id, {
      include: [
        {
          model: Prospect,
          as: 'prospect'
        }
      ]
    });

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
    const data = sanitizeData(req.body);

    if (!data.name) {
      return res.status(400).json({
        message: 'Le nom du client est obligatoire.'
      });
    }

    const client = await Client.create(data);

    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
};

// Modifier un client

exports.update = async (req, res, next) => {
  try {
    const client = await Client.findByPk(req.params.id);

    if (!client) {
      return res.status(404).json({
        message: 'Client introuvable.'
      });
    }

    await client.update(sanitizeData(req.body));

    res.json(client);
  } catch (error) {
    next(error);
  }
};

// Archiver un client

exports.archive = async (req, res, next) => {
  try {
    const client = await Client.findByPk(req.params.id);

    if (!client) {
      return res.status(404).json({
        message: 'Client introuvable.'
      });
    }

    await client.update({
      status: 'Archivé'
    });

    res.json(client);
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
        message: 'Ce prospect est déjà associé à un client.'
      });

    }

    next(error);

  }

};