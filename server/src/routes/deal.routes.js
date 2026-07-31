'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/deal.controller');
const {
  createDealSchema,
  updateDealSchema,
  moveDealSchema,
  listDealsSchema,
  noteSchema,
  idParamSchema,
} = require('../validators/deal.validator');

const router = express.Router();

router.use(protect);

// Collection-level and aggregate routes must precede `/:id`.
router.get('/board', ctrl.getBoard);
router.get('/stats', ctrl.getStats);

router
  .route('/')
  .get(validate(listDealsSchema, 'query'), ctrl.listDeals)
  .post(validate(createDealSchema), ctrl.createDeal);

router
  .route('/:id')
  .all(validate(idParamSchema, 'params'))
  .get(ctrl.getDeal)
  .patch(validate(updateDealSchema), ctrl.updateDeal)
  .delete(ctrl.deleteDeal);

router.patch(
  '/:id/move',
  validate(idParamSchema, 'params'),
  validate(moveDealSchema),
  ctrl.moveDeal
);

router.post('/:id/notes', validate(idParamSchema, 'params'), validate(noteSchema), ctrl.addNote);

router.patch('/:id/archive', validate(idParamSchema, 'params'), ctrl.archiveDeal);
router.patch('/:id/restore', validate(idParamSchema, 'params'), ctrl.restoreDeal);

module.exports = router;
