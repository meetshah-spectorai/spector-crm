'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../services/token.service');

/**
 * Verifies the bearer access token and attaches the live user to `req.user`.
 *
 * This is the only authorisation layer in the app: everyone who is signed in is
 * a peer with full access to the shared pipeline.
 */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) throw ApiError.unauthorized('Missing authentication token');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid authentication token'
    );
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.tokenVersion !== payload.tv) throw ApiError.unauthorized('Session is no longer valid');

  req.user = user;
  return next();
});

module.exports = { protect };
