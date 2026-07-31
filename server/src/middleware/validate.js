'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Validates `req[source]` against a Zod schema and replaces it with the parsed
 * result, so controllers only ever see coerced, whitelisted data.
 */
const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }

    // req.query/req.params are getters on some Express versions — assign safely.
    if (source === 'body') req.body = result.data;
    else Object.defineProperty(req, source, { value: result.data, writable: true });

    return next();
  };

module.exports = validate;
