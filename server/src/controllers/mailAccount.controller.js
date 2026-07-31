'use strict';

const MailAccount = require('../models/MailAccount');
const EmailMessage = require('../models/EmailMessage');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/env');
const logger = require('../utils/logger');
const { encrypt } = require('../utils/crypto');
const { publicProviders, resolveConnection } = require('../services/mail/providers');
const { verifyAccount, syncAccount } = require('../services/mail/imapSync');

/** GET /api/mail-accounts — connected mailboxes plus the provider catalogue. */
const listAccounts = asyncHandler(async (req, res) => {
  const accounts = await MailAccount.find({})
    .populate('user', 'name email')
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    success: true,
    data: accounts,
    meta: {
      providers: publicProviders(),
      // Without an encryption key we refuse to store credentials at all.
      encryptionConfigured: config.mailboxSyncReady,
      syncEnabled: config.ENABLE_MAIL_SYNC,
      syncCron: config.MAIL_SYNC_CRON,
      backfillDays: config.MAIL_BACKFILL_DAYS,
    },
  });
});

/**
 * POST /api/mail-accounts — connect a mailbox.
 * Credentials are verified against the server before anything is written, so a
 * wrong app password fails here rather than silently in the background job.
 */
const createAccount = asyncHandler(async (req, res) => {
  if (!config.mailboxSyncReady) {
    throw ApiError.badRequest(
      'MAIL_ENCRYPTION_KEY is not set on the server, so mailbox credentials cannot be stored securely. ' +
        'Add it to server/.env and restart.'
    );
  }

  const { provider, email, password, host, port, secure, authUser } = req.body;

  if (await MailAccount.exists({ email })) {
    throw ApiError.conflict('That mailbox is already connected');
  }
  if (provider === 'imap' && !host) {
    throw ApiError.badRequest('An IMAP host is required for a generic mailbox');
  }

  const check = await verifyAccount({ provider, email, host, port, secure, authUser, password });
  if (!check.ok) throw ApiError.badRequest(check.error);

  const resolved = resolveConnection({ provider, host, port, secure });
  const account = await MailAccount.create({
    user: req.user._id,
    provider,
    email,
    host: resolved.host,
    port: resolved.port,
    secure: resolved.secure,
    authUser: authUser || '',
    authPassEnc: encrypt(password),
  });

  // First sync in the background: the initial backfill can take a while and the
  // dialog should not hang on it.
  syncAccount(account._id).catch((err) => logger.error('[mail] initial sync:', err.message));

  res.status(201).json({
    success: true,
    data: account.toJSON(),
    meta: { sentFolder: check.sentFolder, inboxMessages: check.inboxMessages },
  });
});

/** POST /api/mail-accounts/:id/sync — sync one mailbox now. */
const syncNow = asyncHandler(async (req, res) => {
  const account = await MailAccount.findById(req.params.id);
  if (!account) throw ApiError.notFound('Mailbox not found');

  const result = await syncAccount(account._id);
  if (result.error) throw ApiError.badRequest(result.error);

  const fresh = await MailAccount.findById(account._id).lean();
  res.json({
    success: true,
    data: fresh,
    message: result.skipped
      ? 'A sync is already running for this mailbox'
      : `Synced — ${result.stored || 0} new message(s)`,
  });
});

/** PATCH /api/mail-accounts/:id — pause or resume syncing. */
const updateAccount = asyncHandler(async (req, res) => {
  const account = await MailAccount.findById(req.params.id);
  if (!account) throw ApiError.notFound('Mailbox not found');

  if (req.body.isActive !== undefined) account.isActive = req.body.isActive;
  await account.save();

  res.json({ success: true, data: account.toJSON() });
});

/**
 * DELETE /api/mail-accounts/:id — disconnect.
 * Removes the stored credential and every message synced from that mailbox; the
 * activity-log entries stay, since they are the deal's history.
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const account = await MailAccount.findById(req.params.id);
  if (!account) throw ApiError.notFound('Mailbox not found');

  const { deletedCount } = await EmailMessage.deleteMany({ account: account._id });
  await account.deleteOne();

  res.json({
    success: true,
    message: `Disconnected ${account.email} and removed ${deletedCount} synced message(s)`,
  });
});

module.exports = { listAccounts, createAccount, syncNow, updateAccount, deleteAccount };
