const express = require('express');

const quoteController = require('../controllers/quote.controller');

const router = express.Router();

// ==========================================
// CONSULTATION ET STATISTIQUES
// ==========================================

// Liste des devis
router.get('/', quoteController.findAll);

// Statistiques commerciales
router.get('/stats', quoteController.getStats);

// Consultation d'un devis
router.get('/:id', quoteController.findOne);

// ==========================================
// GESTION DES BROUILLONS
// ==========================================

// Création
router.post('/', quoteController.create);

// Modification
router.patch('/:id', quoteController.update);

// Duplication
router.post('/:id/duplicate', quoteController.duplicate);

// Suppression
router.delete('/:id', quoteController.remove);

// ==========================================
// CYCLE DE VIE DU DEVIS
// ==========================================

// Émission définitive
router.post('/:id/issue', quoteController.issue);

// Acceptation
router.post('/:id/accept', quoteController.accept);

// Refus
router.post('/:id/refuse', quoteController.refuse);

// Annulation
router.post('/:id/cancel', quoteController.cancel);

// Expiration
router.post('/:id/expire', quoteController.expire);

// ==========================================
// EXPORT
// ==========================================

module.exports = router;