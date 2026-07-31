'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/stage.controller');
const { createStageSchema, updateStageSchema } = require('../validators/stage.validator');
const { idParamSchema } = require('../validators/deal.validator');

const router = express.Router();

router.use(protect);

router.route('/').get(ctrl.listStages).post(validate(createStageSchema), ctrl.createStage);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateStageSchema),
  ctrl.updateStage
);

// Reordering and deleting columns slot in here as PATCH /reorder and
// DELETE /:id — the Stage model already carries `order` and `isDefault` for them.

module.exports = router;
