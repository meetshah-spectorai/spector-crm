'use strict';

const User = require('../models/User');
const Deal = require('../models/Deal');
const Reminder = require('../models/Reminder');
const Note = require('../models/Note');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { verifyIdToken } = require('../services/google.service');
const { REMINDER_STATUS } = require('../utils/constants');
const {
  REFRESH_COOKIE,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../services/token.service');

/** Issues both tokens: access in the JSON body, refresh in an httpOnly cookie. */
function issueSession(res, user) {
  setRefreshCookie(res, signRefreshToken(user));
  return signAccessToken(user);
}

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with that email already exists');
  }

  const user = await User.create({ name, email, password });

  const accessToken = issueSession(res, user);
  res.status(201).json({ success: true, data: { user, accessToken } });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +tokenVersion');
  // Same error for unknown email and wrong password — do not leak which it was.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const accessToken = issueSession(res, user);
  res.json({ success: true, data: { user: user.toJSON(), accessToken } });
});

/**
 * POST /api/auth/google
 *
 * Sign in (or sign up) with a Google ID token from the browser. Three cases:
 *
 *   - the googleId is already known  → sign that person in
 *   - the email matches an existing account → link Google to it. Safe because
 *     Google has verified the address, and it is the same person either way;
 *     without this, anyone who registered with a password could never use the
 *     button.
 *   - neither → create an account, exactly as open registration already allows
 *
 * Accounts created this way have no password until the owner sets one.
 */
const googleLogin = asyncHandler(async (req, res) => {
  const { googleId, email, name } = await verifyIdToken(req.body.credential);

  let user = await User.findOne({ googleId }).select('+tokenVersion');
  let created = false;

  if (!user) {
    user = await User.findOne({ email }).select('+tokenVersion');

    if (user) {
      user.googleId = googleId;
    } else {
      user = new User({ name, email, googleId, hasPassword: false });
      created = true;
    }
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  if (created) logger.info(`Account created via Google sign-in: ${email}`);

  const accessToken = issueSession(res, user);
  res.status(created ? 201 : 200).json({
    success: true,
    data: { user: user.toJSON(), accessToken },
  });
});

/**
 * POST /api/auth/refresh
 * Exchanges the refresh cookie for a new access token (and rotates the cookie).
 */
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies ? req.cookies[REFRESH_COOKIE] : null;
  if (!token) throw ApiError.unauthorized('No refresh token provided');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh token is invalid or expired');
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== payload.tv) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Session is no longer valid');
  }

  const accessToken = issueSession(res, user);
  res.json({ success: true, data: { user: user.toJSON(), accessToken } });
});

/** POST /api/auth/logout */
const logout = asyncHandler(async (req, res) => {
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Signed out' });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toJSON() } });
});

/** PATCH /api/auth/me */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, notificationPrefs } = req.body;
  const user = req.user;

  if (name !== undefined) user.name = name;
  if (notificationPrefs) {
    user.notificationPrefs = { ...user.notificationPrefs.toObject(), ...notificationPrefs };
  }
  await user.save();

  res.json({ success: true, data: { user: user.toJSON() } });
});

/**
 * POST /api/auth/change-password
 * Bumps tokenVersion, which invalidates every previously issued token.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password +tokenVersion');

  // An account created through Google has no password, so there is nothing to
  // re-authenticate against — the bearer token is the proof of identity, and
  // this call becomes "set a password" instead of "change" it.
  const wasPasswordless = !user.hasPassword;

  if (!wasPasswordless) {
    if (!currentPassword) throw ApiError.badRequest('Current password is required');
    if (!(await user.comparePassword(currentPassword))) {
      throw ApiError.badRequest('Current password is incorrect');
    }
  }

  user.password = newPassword;
  user.tokenVersion += 1;
  await user.save();

  const accessToken = issueSession(res, user);
  res.json({
    success: true,
    message: wasPasswordless ? 'Password set' : 'Password updated',
    data: { accessToken, user: user.toJSON() },
  });
});

/**
 * DELETE /api/auth/me — delete your own account.
 *
 * Everyone is a peer, so there is no admin to do this for you. Guards:
 *   - the password must be re-entered (destructive, irreversible). A Google
 *     account with no password re-authenticates through its access token
 *     instead, plus the typed confirmation the client insists on.
 *   - deals and open tasks must be handed to a named teammate, so nothing is
 *     silently orphaned
 *   - the last remaining account cannot be deleted, which would leave the
 *     pipeline with no way in
 */
const deleteMyAccount = asyncHandler(async (req, res) => {
  const { password, transferTo } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  if (user.hasPassword) {
    if (!password) throw ApiError.badRequest('Enter your password to confirm');
    if (!(await user.comparePassword(password))) {
      throw ApiError.badRequest('Password is incorrect');
    }
  }

  const remaining = await User.countDocuments({ _id: { $ne: user._id } });
  if (remaining === 0) {
    throw ApiError.badRequest(
      'This is the only account. Deleting it would leave the CRM with no way in — create another account first.'
    );
  }

  const [ownedDeals, openTasks] = await Promise.all([
    Deal.countDocuments({ owner: user._id }),
    Reminder.countDocuments({ assignedTo: user._id, status: REMINDER_STATUS.PENDING }),
  ]);

  const needsTransfer = ownedDeals > 0 || openTasks > 0;

  if (needsTransfer && !transferTo) {
    throw ApiError.badRequest(
      `Choose a teammate to take over first: you own ${ownedDeals} deal(s) and ${openTasks} open task(s).`,
      [
        { field: 'transferTo', message: 'Pick who inherits this work' },
        { field: 'ownedDeals', message: String(ownedDeals) },
        { field: 'openTasks', message: String(openTasks) },
      ]
    );
  }

  let heir = null;
  if (transferTo) {
    if (String(transferTo) === String(user._id)) {
      throw ApiError.badRequest('Pick a different teammate to take over');
    }
    heir = await User.findById(transferTo).select('_id name email');
    if (!heir) throw ApiError.badRequest('That teammate no longer exists');
  }

  if (heir) {
    await Promise.all([
      Deal.updateMany({ owner: user._id }, { $set: { owner: heir._id } }),
      // Reassign authorship too, so nothing is left pointing at a missing user.
      Deal.updateMany({ createdBy: user._id }, { $set: { createdBy: heir._id } }),
      Reminder.updateMany({ assignedTo: user._id }, { $set: { assignedTo: heir._id } }),
      Reminder.updateMany({ createdBy: user._id }, { $set: { createdBy: heir._id } }),
      // Notes are part of a deal's history — keep them, under the heir's name.
      Note.updateMany({ author: user._id }, { $set: { author: heir._id } }),
    ]);
  }

  await user.deleteOne();

  clearRefreshCookie(res);
  res.json({
    success: true,
    message: heir
      ? `Account deleted. ${ownedDeals} deal(s) and ${openTasks} task(s) now belong to ${heir.name}.`
      : 'Account deleted.',
  });
});

module.exports = {
  register,
  login,
  googleLogin,
  refresh,
  logout,
  me,
  updateProfile,
  changePassword,
  deleteMyAccount,
};
