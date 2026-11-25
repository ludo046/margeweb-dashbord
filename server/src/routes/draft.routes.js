
const express = require('express');

const draftController = require(
  '../controllers/draft.controller'
);

const router = express.Router();

router.get('/', draftController.findAll);

router.get('/count', draftController.count);

router.get('/:id', draftController.findOne);

router.post('/', draftController.create);

router.patch('/:id', draftController.update);

router.delete('/:id', draftController.remove);

module.exports = router;
