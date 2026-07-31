'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const message = { success: false, message: 'Too many requests — please try again shortly.' };

/** Broad protection for the whole API surface. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isProd ? 200 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

/** Tight limit on credential endpoints to slow down brute-force attempts. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 20 : 100,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts — please try again in 15 minutes.' },
});

module.exports = { apiLimiter, authLimiter };
