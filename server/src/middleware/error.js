'use strict';

const config = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/* eslint-disable-next-line no-unused-vars */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  // --- Translate driver / ODM errors into clean API responses ---------------
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || { field: '' })[0];
    message = `A record with that ${field} already exists`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired';
  }

  // A thrown ApiError is a decision the code made, so its message is safe to
  // show and is not a crash. Anything else at 5xx is a bug: log the stack and
  // tell the client nothing beyond "it broke".
  const deliberate = err instanceof ApiError || err.isOperational === true;

  if (statusCode >= 500 && !deliberate) {
    logger.error(`${req.method} ${req.originalUrl} →`, err.stack || err.message);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} → ${statusCode} ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 && config.isProd && !deliberate ? 'Internal server error' : message,
    ...(details ? { details } : {}),
    ...(config.isProd ? {} : { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
