'use strict';

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const MailAccount = require('../../models/MailAccount');
const EmailMessage = require('../../models/EmailMessage');
const config = require('../../config/env');
const logger = require('../../utils/logger');
const { decrypt } = require('../../utils/crypto');
const { resolveConnection } = require('./providers');
const { resolveThreadKey } = require('./threading');
const { buildContactIndex, matchParticipants, normalize } = require('./contactIndex');
const { logActivity } = require('../activity.service');

/** Guards against a slow run overlapping the next scheduled one. */
const running = new Set();

/* ------------------------------------------------------------------ helpers */

const addr = (a) => ({ name: a?.name || '', email: normalize(a?.address) });

const addrList = (list) => (list?.value || []).map(addr).filter((a) => a.email);

/** First couple of lines of the body, collapsed to a single line. */
function makePreview(text = '', limit = 180) {
  const cleaned = String(text)
    .replace(/\r/g, '')
    // Drop quoted history so the preview shows the new message, not the reply chain.
    .split(/\n>|\nOn .* wrote:|\n-{2,} ?Original Message/i)[0]
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}…` : cleaned;
}

/** Normalises a Message-ID/References header into a bare list. */
const idList = (value) => {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : String(value).split(/\s+/);
  return arr.map((v) => String(v).replace(/[<>]/g, '').trim()).filter(Boolean);
};

/** Finds the Sent folder: \Sent special-use first, then provider name guesses. */
async function findSentFolder(client, candidates) {
  const boxes = await client.list();
  const special = boxes.find((b) => b.specialUse === '\\Sent' || b.flags?.has?.('\\Sent'));
  if (special) return special.path;

  const byName = boxes.find((b) => candidates.includes(b.path));
  if (byName) return byName.path;

  const loose = boxes.find((b) => /sent/i.test(b.path));
  return loose ? loose.path : null;
}

/* -------------------------------------------------------------- persistence */

/** Stores one parsed message. Returns 'stored' | 'skipped'. */
async function persist({ account, parsed, folder, uid, isUnread, contactIndex, direction }) {
  const from = addr(parsed.from?.value?.[0]);
  const to = addrList(parsed.to);
  const cc = addrList(parsed.cc);

  const participants = [
    ...new Set([from.email, ...to.map((a) => a.email), ...cc.map((a) => a.email)].filter(Boolean)),
  ];

  const { dealLinks, matches } = matchParticipants(contactIndex, participants);
  // Belt and braces: the IMAP search already targeted contact addresses.
  if (!dealLinks.length) return { outcome: 'skipped' };

  const messageId = idList(parsed.messageId)[0] || `${account._id}-${folder}-${uid}`;

  const bodyText = parsed.text || '';
  const threadKey = await resolveThreadKey({
    accountId: account._id,
    messageId,
    inReplyTo: idList(parsed.inReplyTo)[0] || '',
    references: idList(parsed.references),
    subject: parsed.subject || '',
    participants,
  });

  const attachments = (parsed.attachments || [])
    // Inline images (signatures, logos) are not "attachments" to a reader.
    .filter((a) => a.contentDisposition !== 'inline' && a.filename)
    .map((a) => ({
      filename: a.filename,
      contentType: a.contentType || 'application/octet-stream',
      size: a.size || 0,
    }));

  // Upsert so a concurrent run or a re-sync can never duplicate a message.
  const res = await EmailMessage.updateOne(
    { account: account._id, messageId },
    {
      $set: { isUnread, folder, uid },
      $setOnInsert: {
        account: account._id,
        messageId,
        inReplyTo: idList(parsed.inReplyTo)[0] || '',
        references: idList(parsed.references),
        threadKey,
        direction,
        from,
        to,
        cc,
        subject: parsed.subject || '(no subject)',
        preview: makePreview(bodyText || String(parsed.html || '').replace(/<[^>]+>/g, ' ')),
        bodyText,
        bodyHtml: parsed.html || '',
        attachments,
        hasAttachments: attachments.length > 0,
        sentAt: parsed.date || new Date(),
        participants,
        dealLinks,
      },
    },
    { upsert: true }
  );

  if (!res.upsertedCount) return { outcome: 'skipped' };

  // Requirement: every synced email shows up on the deal's timeline.
  const seenDeals = new Set();
  for (const match of matches) {
    if (seenDeals.has(String(match.dealId))) continue;
    seenDeals.add(String(match.dealId));

    const who = match.contactName || match.contactEmail;
    await logActivity({
      type: direction === 'sent' ? 'email.sent' : 'email.received',
      message:
        direction === 'sent'
          ? `Email sent to ${who}: "${parsed.subject || '(no subject)'}"`
          : `Email received from ${who}: "${parsed.subject || '(no subject)'}"`,
      deal: match.dealId,
      actor: null,
      meta: {
        threadKey,
        subject: parsed.subject || '',
        mailbox: account.email,
        at: parsed.date || new Date(),
      },
    });
  }

  return { outcome: 'stored' };
}

/* ---------------------------------------------------------------- one folder */

/**
 * Syncs one folder.
 *
 * The server does the filtering: an IMAP SEARCH per contact address returns just
 * the handful of relevant UIDs, instead of us downloading the whole folder and
 * discarding 99% of it. Envelopes are fetched first (cheap) so message bodies are
 * only pulled for mail we do not already have.
 */
async function syncFolder({ client, account, folder, direction, contactIndex, addresses }) {
  if (!addresses.length) return 0;

  const lock = await client.getMailboxLock(folder);
  let stored = 0;

  try {
    const since = new Date(Date.now() - config.MAIL_BACKFILL_DAYS * 86400000);

    // 1. Ask the server which messages involve a CRM contact.
    const uidSet = new Set();
    for (const address of addresses) {
      const hits = await client.search(
        { since, or: [{ from: address }, { to: address }, { cc: address }] },
        { uid: true }
      );
      (hits || []).forEach((u) => uidSet.add(u));
    }

    if (!uidSet.size) {
      logger.debug(`[mail] ${account.email} ${folder}: no contact matches`);
      return 0;
    }

    // Newest first, capped so one run can never balloon.
    const uids = [...uidSet].sort((a, b) => b - a).slice(0, config.MAIL_MAX_PER_RUN);

    // 2. Envelopes only, to find out what is actually new.
    const candidates = [];
    for await (const msg of client.fetch(uids, { uid: true, envelope: true, flags: true }, { uid: true })) {
      candidates.push({
        uid: msg.uid,
        messageId: idList(msg.envelope?.messageId)[0] || '',
        seen: Boolean(msg.flags?.has?.('\\Seen')),
      });
    }

    const knownIds = new Set(
      (
        await EmailMessage.find({
          account: account._id,
          messageId: { $in: candidates.map((c) => c.messageId).filter(Boolean) },
        })
          .select('messageId')
          .lean()
      ).map((d) => d.messageId)
    );

    const fresh = candidates.filter((c) => !c.messageId || !knownIds.has(c.messageId));

    logger.info(
      `[mail] ${account.email} ${folder}: ${uids.length} contact match(es), ${fresh.length} new`
    );

    if (!fresh.length) return 0;

    // 3. Full source only for the new ones.
    const byUid = new Map(fresh.map((f) => [f.uid, f]));
    for await (const msg of client.fetch(
      fresh.map((f) => f.uid),
      { uid: true, source: true },
      { uid: true }
    )) {
      try {
        const parsed = await simpleParser(msg.source);
        const meta = byUid.get(msg.uid);
        const { outcome } = await persist({
          account,
          parsed,
          folder,
          uid: msg.uid,
          isUnread: direction === 'received' ? !meta?.seen : false,
          contactIndex,
          direction,
        });
        if (outcome === 'stored') stored += 1;
      } catch (err) {
        // One malformed message must not abort the folder.
        logger.warn(`[mail] ${account.email} ${folder} uid=${msg.uid}: ${err.message}`);
      }
    }
  } finally {
    lock.release();
  }

  return stored;
}

/* ------------------------------------------------------------- one mailbox */

/** Syncs INBOX (received) and the Sent folder for a single account. */
async function syncAccount(accountId) {
  const id = String(accountId);
  if (running.has(id)) return { skipped: 'already running' };
  running.add(id);

  const account = await MailAccount.findById(accountId).select('+authPassEnc');
  if (!account) {
    running.delete(id);
    return { error: 'Mailbox not found' };
  }

  account.lastSyncStatus = 'running';
  await account.save({ validateBeforeSave: false });

  const { host, port, secure, sentFolders } = resolveConnection(account);
  let client;

  try {
    const contactIndex = await buildContactIndex();
    const addresses = [...contactIndex.keys()];

    if (!addresses.length) {
      account.lastSyncAt = new Date();
      account.lastSyncStatus = 'ok';
      account.lastSyncError = '';
      account.lastSyncCount = 0;
      await account.save({ validateBeforeSave: false });
      logger.warn('[mail] no deal has a contact email — nothing to match against');
      return { stored: 0, note: 'no contact addresses in the CRM' };
    }

    client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user: account.authUser || account.email, pass: decrypt(account.authPassEnc) },
      logger: false,
      emitLogs: false,
      socketTimeout: 90_000,
      greetingTimeout: 20_000,
    });

    await client.connect();

    let stored = 0;
    stored += await syncFolder({
      client,
      account,
      folder: 'INBOX',
      direction: 'received',
      contactIndex,
      addresses,
    });

    const sent = await findSentFolder(client, sentFolders);
    if (sent) {
      stored += await syncFolder({
        client,
        account,
        folder: sent,
        direction: 'sent',
        contactIndex,
        addresses,
      });
    } else {
      logger.warn(`[mail] ${account.email}: no Sent folder found; only received mail synced`);
    }

    account.lastSyncAt = new Date();
    account.lastSyncStatus = 'ok';
    account.lastSyncError = '';
    account.lastSyncCount = stored;
    account.totalMessages = await EmailMessage.countDocuments({ account: account._id });
    await account.save({ validateBeforeSave: false });

    logger.info(`[mail] ${account.email}: ${stored} new, ${account.totalMessages} stored in total`);
    return { stored, total: account.totalMessages };
  } catch (err) {
    account.lastSyncAt = new Date();
    account.lastSyncStatus = 'error';
    account.lastSyncError = explain(err);
    await account.save({ validateBeforeSave: false });
    logger.error(`[mail] ${account.email} sync failed: ${err.message}`);
    return { error: account.lastSyncError };
  } finally {
    if (client) await client.logout().catch(() => {});
    running.delete(id);
  }
}

/** Turns IMAP failures into something a user can act on. */
function explain(err) {
  const m = err.message || '';
  if (/AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed|auth/i.test(m)) {
    return 'Sign-in was rejected. Gmail and most providers need an app password, not the account password.';
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)) return 'Could not resolve the IMAP host — check the server address.';
  if (/ECONNREFUSED/i.test(m)) return 'Connection refused — check the IMAP host and port.';
  if (/timeout|ETIMEDOUT/i.test(m)) return 'The mail server did not respond in time.';
  if (/IMAP.*disabled|not enabled/i.test(m)) return 'IMAP is disabled for this mailbox — enable it in the provider settings.';
  return m.slice(0, 300);
}

/**
 * Clears mailboxes left marked "running" by a process that died mid-sync.
 * Nothing can actually be in flight right after a restart, so a stale flag would
 * otherwise make the UI claim a sync is ongoing forever.
 */
async function resetStaleSyncState() {
  const { modifiedCount } = await MailAccount.updateMany(
    { lastSyncStatus: 'running' },
    { $set: { lastSyncStatus: 'never', lastSyncError: '' } }
  );
  if (modifiedCount) {
    logger.warn(`[mail] cleared ${modifiedCount} interrupted sync flag(s) from a previous run`);
  }
  return modifiedCount;
}

/** Syncs every active mailbox, one after another. */
async function syncAllAccounts() {
  const accounts = await MailAccount.find({ isActive: true }).select('_id email').lean();
  if (!accounts.length) return { accounts: 0, stored: 0 };

  let stored = 0;
  for (const a of accounts) {
    const res = await syncAccount(a._id);
    stored += res.stored || 0;
  }
  return { accounts: accounts.length, stored };
}

/**
 * Connect-time credential check. Opens a session, confirms INBOX and the Sent
 * folder are readable, then disconnects — so a bad password fails at the point
 * the user can still fix it, not silently in a background job.
 */
async function verifyAccount({ provider, email, host, port, secure, authUser, password }) {
  const preset = resolveConnection({ provider, host, port, secure });
  const client = new ImapFlow({
    host: preset.host,
    port: preset.port,
    secure: preset.secure,
    auth: { user: authUser || email, pass: password },
    logger: false,
    emitLogs: false,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const total = client.mailbox.exists;
    lock.release();
    const sent = await findSentFolder(client, preset.sentFolders);
    return { ok: true, inboxMessages: total, sentFolder: sent };
  } catch (err) {
    return { ok: false, error: explain(err) };
  } finally {
    await client.logout().catch(() => {});
  }
}

module.exports = {
  syncAccount,
  syncAllAccounts,
  verifyAccount,
  resetStaleSyncState,
  makePreview,
};
