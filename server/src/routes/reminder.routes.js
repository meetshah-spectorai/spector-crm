'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/reminder.controller');
const {
  createReminderSchema,
  updateReminderSchema,
  listRemindersSchema,
} = require('../validators/reminder.validator');
const { idParamSchema } = require('../validators/deal.validator');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(validate(listRemindersSchema, 'query'), ctrl.listReminders)
  .post(validate(createReminderSchema), ctrl.createReminder);

router
  .route('/:id')
  .all(validate(idParamSchema, 'params'))
  .get(ctrl.getReminder)
  .patch(validate(updateReminderSchema), ctrl.updateReminder)
  .delete(ctrl.deleteReminder);

router.post('/:id/complete', validate(idParamSchema, 'params'), ctrl.completeReminder);

module.exports = router;
