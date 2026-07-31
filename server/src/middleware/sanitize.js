'use strict';

/**
 * Strips MongoDB operator keys ($gt, $ne, …) and dotted paths from request
 * payloads, so a body like `{ "email": { "$ne": null } }` can never reach a
 * query and turn into a NoSQL injection.
 */
const FORBIDDEN_KEY = /^\$|\./;

function scrub(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      value[i] = scrub(item, depth + 1);
    });
    return value;
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEY.test(key)) delete value[key];
    else value[key] = scrub(value[key], depth + 1);
  }
  return value;
}

function sanitizeRequest(req, res, next) {
  if (req.body) scrub(req.body);
  if (req.params) scrub(req.params);
  // req.query is a getter in Express 5; mutate its contents in place.
  if (req.query) scrub(req.query);
  return next();
}

module.exports = sanitizeRequest;
