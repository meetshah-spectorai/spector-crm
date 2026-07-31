'use strict';

/**
 * Wraps an async route handler so rejected promises reach Express' error
 * middleware instead of becoming unhandled rejections.
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
