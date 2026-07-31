'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/mailAccount.controller');
const { createAccountSchema, updateAccountSchema } = require('../validators/mail.validator');
const { idParamSchema } = require('../validators/deal.validator');

const router = express.Router();

router.use(protect);

router.route('/').get(ctrl.listAccounts).post(validate(createAccountSchema), ctrl.createAccount);

router
  .route('/:id')
  .all(validate(idParamSchema, 'params'))
  .patch(validate(updateAccountSchema), ctrl.updateAccount)
  .delete(ctrl.deleteAccount);

router.post('/:id/sync', validate(idParamSchema, 'params'), ctrl.syncNow);

module.exports = router;
