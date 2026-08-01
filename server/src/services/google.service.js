'use strict';

const { OAuth2Client } = require('google-auth-library');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Google sign-in, ID-token flow.
 *
 * The browser runs Google Identity Services and hands us a signed ID token (a
 * JWT). We verify the signature against Google's published keys and check that
 * the token was minted for *our* client id — an unverified token, or one issued
 * for someone else's app, proves nothing.
 *
 * There is no OAuth client secret and no redirect leg: we only authenticate the
 * person, we never call Google APIs on their behalf.
 */

// The client caches Google's public keys, so keep one instance for the process.
let client = null;
const getClient = () => {
  if (!client) client = new OAuth2Client(config.GOOGLE_CLIENT_ID);
  return client;
};

/**
 * Verifies a Google ID token and returns the identity inside it.
 * Throws an ApiError — never a raw library error — so the route answers 401.
 */
async function verifyIdToken(credential) {
  if (!config.googleAuthEnabled) {
    throw new ApiError(503, 'Google sign-in is not configured on this server');
  }

  let payload;
  try {
    const ticket = await getClient().verifyIdToken({
      idToken: credential,
      audience: config.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    // Expired, tampered with, or issued for a different client id.
    throw ApiError.unauthorized('Google sign-in could not be verified — please try again');
  }

  // `verifyIdToken` already checks the issuer, audience and expiry; these two are
  // ours to insist on.
  if (!payload?.email) {
    throw ApiError.unauthorized('That Google account did not share an email address');
  }
  if (payload.email_verified === false) {
    throw ApiError.unauthorized('That Google email address is not verified');
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).toLowerCase(),
    name: payload.name || payload.given_name || payload.email.split('@')[0],
  };
}

module.exports = { verifyIdToken };
