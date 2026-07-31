'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const config = require('./config/env');
const routes = require('./routes');
const sanitizeRequest = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Render/Railway/Vercel sit behind a proxy: needed for correct client IPs
// (rate limiting) and for `secure` cookies to be sent.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/tooling requests that send no Origin header.
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (config.clientOrigins.includes(normalized)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true, // required for the refresh-token cookie
  })
);

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
app.use(cookieParser());
app.use(compression());
app.use(sanitizeRequest);

if (!config.isProd) app.use(morgan('dev'));
else app.use(morgan('combined'));

app.get('/', (req, res) =>
  res.json({ success: true, name: 'Spector.AI CRM API', version: '1.0.0', docs: '/api/health' })
);

app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
