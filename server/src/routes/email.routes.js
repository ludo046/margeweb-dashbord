
const express = require('express');

const controller = require('../controllers/email.controller');
const mailController = require('../controllers/mail.controller');

const router = express.Router();

// Consultation
router.get('/', controller.findAll);
router.get('/unread-count', controller.unreadCount);

// Synchronisation
router.post('/sync', controller.sync);

// Nouveau message
router.post('/send', mailController.sendNew);

// Consultation individuelle
router.get('/:id', controller.findOne);

// État de lecture
router.patch('/:id/read', controller.markAsRead);

// Réponse
router.post('/:id/reply', mailController.reply);

module.exports = router;
