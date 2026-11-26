const { Op } = require('sequelize');

const {
  Email,
  Prospect,
  Client
} = require('../models');

const imapService = require('../services/imap.service');

// Associations communes

const emailIncludes = [
  {
    model: Prospect,
    as: 'prospect',
    attributes: ['id', 'name']
  },
  {
    model: Client,
    as: 'client',
    attributes: ['id', 'name', 'status']
  }
];

// Récupérer les messages

exports.findAll = async (req, res, next) => {
  try {

    const folder = req.query.folder || 'INBOX';

    const search = String(
      req.query.search || ''
    ).trim();

    const where = {};

    // Filtrer par dossier
    // ALL permet de récupérer tous les dossiers

    if (folder !== 'ALL') {
      where.folder = folder;
    }

    // Filtrer par client

    if (req.query.clientId !== undefined) {

      const clientId = Number(req.query.clientId);

      if (!Number.isSafeInteger(clientId) || clientId <= 0) {
        return res.status(400).json({
          message: 'Identifiant client invalide.'
        });
      }

      where.clientId = clientId;

    }

    // Filtrer par prospect

    if (req.query.prospectId !== undefined) {

      const prospectId = Number(req.query.prospectId);

      if (!Number.isSafeInteger(prospectId) || prospectId <= 0) {
        return res.status(400).json({
          message: 'Identifiant prospect invalide.'
        });
      }

      where.prospectId = prospectId;

    }

    // Recherche textuelle

    if (search) {

      where[Op.or] = [

        {
          subject: {
            [Op.like]: `%${search}%`
          }
        },

        {
          fromName: {
            [Op.like]: `%${search}%`
          }
        },

        {
          fromEmail: {
            [Op.like]: `%${search}%`
          }
        },

        {
          toEmail: {
            [Op.like]: `%${search}%`
          }
        },

        {
          textContent: {
            [Op.like]: `%${search}%`
          }
        }

      ];

    }

    // Pagination

    const limit = Number(req.query.limit ?? 100);
    const offset = Number(req.query.offset ?? 0);

    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 200 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {

      return res.status(400).json({
        message: 'Paramètres de pagination invalides.'
      });

    }

    const emails = await Email.findAll({

      where,

      attributes: {
        exclude: ['htmlContent']
      },

      include: emailIncludes,

      order: [
        ['receivedAt', 'DESC'],
        ['id', 'DESC']
      ],

      limit,
      offset

    });

    res.json(emails);

  } catch (error) {
    next(error);
  }
};

// Récupérer un message

exports.findOne = async (req, res, next) => {
  try {

    const email = await Email.findByPk(req.params.id, {

      attributes: {
        exclude: ['htmlContent']
      },

      include: emailIncludes

    });

    if (!email) {

      return res.status(404).json({
        message: 'E-mail introuvable.'
      });

    }

    res.json(email);

  } catch (error) {
    next(error);
  }
};

// Compter les messages non lus

exports.unreadCount = async (req, res, next) => {
  try {

    const count = await Email.count({

      where: {
        folder: 'INBOX',
        isRead: false
      }

    });

    res.json({ count });

  } catch (error) {
    next(error);
  }
};

// Modifier l'état de lecture

exports.markAsRead = async (req, res, next) => {
  try {

    const email = await Email.findByPk(req.params.id);

    if (!email) {

      return res.status(404).json({
        message: 'E-mail introuvable.'
      });

    }

    if (typeof req.body?.isRead !== 'boolean') {

      return res.status(400).json({
        message: 'État de lecture invalide.'
      });

    }

    await email.update({
      isRead: req.body.isRead
    });

    res.json({
      id: email.id,
      isRead: email.isRead
    });

  } catch (error) {
    next(error);
  }
};

// Synchroniser la messagerie

exports.sync = async (req, res, next) => {
  try {

    const stats = await imapService.syncInbox();

    res.json({
      success: true,
      ...stats
    });

  } catch (error) {

    if ([409, 503].includes(error.status)) {

      return res.status(error.status).json({
        message: error.message
      });

    }

    next(error);

  }
};