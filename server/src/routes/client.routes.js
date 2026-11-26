const express = require('express');

const controller = require('../controllers/client.controller');
const mailController = require('../controllers/mail.controller');

const router = express.Router();

// Liste des clients
router.get('/', controller.findAll);

// Conversion d'un prospect
router.post('/convert/:prospectId', controller.convertProspect);


// Consultation d'un client
router.get('/:id', controller.findOne);

// Création manuelle
router.post('/', controller.create);

// Modification
router.patch('/:id', controller.update);

// Archivage
router.patch('/:id/archive', controller.archive);

// Envoi d'un e-mail
router.post('/:id/send-email', mailController.sendToClient);

module.exports = router;