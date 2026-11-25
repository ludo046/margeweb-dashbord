
const { Op } = require('sequelize');
const { Email, Prospect } = require('../models');
const imapService = require('../services/imap.service');

// Récupérer les messages
exports.findAll = async (req, res, next) => {
  try {
    const folder = req.query.folder || 'INBOX';
    const search = String(req.query.search || '').trim();

    const where = { folder };

    if (search) {
      where[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { fromName: { [Op.like]: `%${search}%` } },
        { fromEmail: { [Op.like]: `%${search}%` } },
        { textContent: { [Op.like]: `%${search}%` } }
      ];
    }

    const emails = await Email.findAll({
      where,
      attributes: {
        exclude: ['htmlContent']
      },
      include: [{
        model: Prospect,
        as: 'prospect',
        attributes: ['id', 'name']
      }],
      order: [['receivedAt', 'DESC']],
      limit: 100
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
      include: [{
        model: Prospect,
        as: 'prospect',
        attributes: ['id', 'name']
      }]
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

// Synchroniser la boîte de réception
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
