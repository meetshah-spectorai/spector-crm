'use strict';

const cron = require('node-cron');
const config = require('../config/env');
const logger = require('../utils/logger');
const { syncAllAccounts, resetStaleSyncState } = require('../services/mail/imapSync');

/**
 * Scheduled mailbox sync.
 *
 * Polling on a cron is the portable choice: Gmail push (Pub/Sub) and Microsoft
 * Graph subscriptions both need a publicly reachable HTTPS endpoint plus a
 * registered app, and generic IMAP has no webhook at all. `syncAccount` is
 * incremental — it resumes from each folder's stored UID cursor — so a run only
 * fetches what has arrived since the last one.
 */
let task = null;
let inFlight = false;

async function runOnce() {
  if (inFlight) {
    logger.warn('[mail] previous sync still running — skipping this tick');
    return { skipped: true };
  }
  inFlight = true;
  try {
    const result = await syncAllAccounts();
    if (result.stored) {
      logger.info(`[mail] sync: ${result.stored} new message(s) across ${result.accounts} mailbox(es)`);
    }
    return result;
  } catch (err) {
    logger.error('[mail] sync run failed:', err.message);
    return { error: err.message };
  } finally {
    inFlight = false;
  }
}

async function startMailSync() {
  if (!config.ENABLE_MAIL_SYNC) {
    logger.warn('Mailbox sync disabled (ENABLE_MAIL_SYNC=false)');
    return;
  }
  if (!config.mailboxSyncReady) {
    logger.warn('Mailbox sync idle — MAIL_ENCRYPTION_KEY is not set, so no mailbox can be connected.');
    return;
  }

  // A restart during a sync would otherwise leave the mailbox stuck on "running".
  await resetStaleSyncState().catch((err) => logger.error('[mail] reset:', err.message));

  task = cron.schedule(config.MAIL_SYNC_CRON, runOnce, { timezone: config.DIGEST_TIMEZONE });
  logger.info(`Mailbox sync scheduled "${config.MAIL_SYNC_CRON}" (${config.DIGEST_TIMEZONE})`);

  // Catch up straight away rather than waiting for the first cron tick.
  runOnce().catch((err) => logger.error('[mail] initial run:', err.message));
}

function stopMailSync() {
  if (task) task.stop();
  task = null;
}

module.exports = { startMailSync, stopMailSync, runOnce };
