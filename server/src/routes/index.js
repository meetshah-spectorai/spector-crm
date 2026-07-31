'use strict';

const express = require('express');
const mongoose = require('mongoose');
const {
  PRIORITIES,
  CURRENCIES,
  DEAL_STATUS_LIST,
  STAGE_COLORS,
  STAGE_OUTCOMES,
} = require('../utils/constants');

const router = express.Router();

/** Liveness/readiness probe for Render/Railway. */
router.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    status: 'ok',
    uptime: Math.round(process.uptime()),
    db: states[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Fixed enums the client renders. Pipeline stages are configurable and live at
 * GET /api/stages, not here.
 */
router.get('/meta', (req, res) => {
  res.json({
    success: true,
    data: {
      priorities: PRIORITIES,
      currencies: CURRENCIES,
      dealStatuses: DEAL_STATUS_LIST,
      stageColors: STAGE_COLORS,
      stageOutcomes: STAGE_OUTCOMES,
    },
  });
});

router.use('/auth', require('./auth.routes'));
router.use('/stages', require('./stage.routes'));
router.use('/deals', require('./deal.routes'));
router.use('/reminders', require('./reminder.routes'));
router.use('/emails', require('./email.routes'));
router.use('/mail-accounts', require('./mailAccount.routes'));
router.use('/activities', require('./activity.routes'));
router.use('/users', require('./user.routes'));

module.exports = router;
