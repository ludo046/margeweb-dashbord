const express = require('express');

const subscriptionController = require(
  '../controllers/subscription.controller'
);

const router = express.Router();

// ==========================================
// CONSULTATION DES ABONNEMENTS
// ==========================================

// Liste des abonnements

router.get(
  '/',
  subscriptionController.findAll
);

// Statistiques et revenus récurrents

router.get(
  '/stats',
  subscriptionController.stats
);

// Détail d'un abonnement

router.get(
  '/:id',
  subscriptionController.findOne
);

// ==========================================
// CRÉATION ET MODIFICATION
// ==========================================

// Créer un abonnement

router.post(
  '/',
  subscriptionController.create
);

// Modifier un abonnement

router.patch(
  '/:id',
  subscriptionController.update
);

// ==========================================
// CYCLE DE VIE DES ABONNEMENTS
// ==========================================

// Activer un abonnement

router.patch(
  '/:id/activate',
  subscriptionController.activate
);

// Suspendre un abonnement

router.patch(
  '/:id/suspend',
  subscriptionController.suspend
);

// Reprendre un abonnement

router.patch(
  '/:id/resume',
  subscriptionController.resume
);

// Résilier un abonnement

router.patch(
  '/:id/cancel',
  subscriptionController.cancel
);

// ==========================================
// EXPORT
// ==========================================

module.exports = router;