'use strict';

const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/user.controller');

const router = express.Router();

// The roster feeds the owner / assignee dropdowns. Nothing else to expose:
// there are no roles or account permissions to administer.
router.get('/', protect, ctrl.listUsers);

module.exports = router;
