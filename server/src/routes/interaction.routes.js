
const express = require('express');
const controller = require('../controllers/interaction.controller');

const router = express.Router({
  mergeParams: true
});

router.get('/', controller.findAll);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
