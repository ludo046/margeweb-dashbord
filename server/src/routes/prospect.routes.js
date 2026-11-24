
const express = require('express');
const controller = require('../controllers/prospect.controller');
const mailController = require('../controllers/mail.controller');

const router = express.Router();

router.get('/', controller.findAll);
router.get('/:id', controller.findOne);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/complete-follow-up',controller.completeFollowUp);
router.post('/:id/send-email', mailController.sendToProspect);

module.exports = router;
