'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/email.controller');
const {
  listDealEmailsSchema,
  dealParamSchema,
  threadParamSchema,
  threadQuerySchema,
} = require('../validators/mail.validator');
const { idParamSchema } = require('../validators/deal.validator');

const router = express.Router();

// Read-only by design: there is no compose, reply, forward or delete route here,
// and none should be added to this file — the tab is a viewer.
router.use(protect);

router.get(
  '/deal/:dealId',
  validate(dealParamSchema, 'params'),
  validate(listDealEmailsSchema, 'query'),
  ctrl.listDealEmails
);

router.get(
  '/thread/:threadKey',
  validate(threadParamSchema, 'params'),
  validate(threadQuerySchema, 'query'),
  ctrl.getThread
);

router.get('/:id', validate(idParamSchema, 'params'), ctrl.getMessage);

module.exports = router;
