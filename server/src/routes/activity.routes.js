'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/activity.controller');
const { listActivitiesSchema } = require('../validators/user.validator');
const { idParamSchema } = require('../validators/deal.validator');

const router = express.Router();

router.use(protect);

router.get('/', validate(listActivitiesSchema, 'query'), ctrl.listActivities);
router.get('/deal/:id', validate(idParamSchema, 'params'), ctrl.listDealActivities);

module.exports = router;
