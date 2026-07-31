'use strict';

const crypto = require('node:crypto');
const EmailMessage = require('../../models/EmailMessage');

/** Strips reply/forward prefixes so "Re: Fwd: Proposal" groups with "Proposal". */
const PREFIX = /^\s*((re|aw|fw|fwd|antwoord|rv|sv|vs|回复|转发)\s*(\[\d+\])?\s*:\s*)+/i;

function normalizeSubject(subject = '') {
  return String(subject)
    .replace(PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const hash = (input) => crypto.createHash('sha1').update(input).digest('hex').slice(0, 24);

/**
 * Works out which conversation a message belongs to, Gmail-style.
 *
 * 1. If the message references an email we have already stored, inherit that
 *    thread. This is the reliable path — it follows the In-Reply-To/References
 *    chain that mail clients maintain.
 * 2. Otherwise fall back to "same normalized subject + same people". This is what
 *    catches conversations where a client dropped the headers, at the cost of
 *    occasionally merging two unrelated threads that share a subject and
 *    participants — the same trade-off Gmail makes.
 */
async function resolveThreadKey({ accountId, messageId, inReplyTo, references, subject, participants }) {
  const refs = [...(references || []), inReplyTo].filter(Boolean);

  if (refs.length) {
    const related = await EmailMessage.findOne({
      account: accountId,
      messageId: { $in: refs },
    })
      .select('threadKey')
      .lean();
    if (related) return related.threadKey;
  }

  // Any already-stored message that replies *to this one* also fixes the thread.
  if (messageId) {
    const child = await EmailMessage.findOne({
      account: accountId,
      $or: [{ inReplyTo: messageId }, { references: messageId }],
    })
      .select('threadKey')
      .lean();
    if (child) return child.threadKey;
  }

  const normalized = normalizeSubject(subject);
  const people = [...new Set(participants || [])].sort().join(',');
  return hash(`${normalized}|${people}`);
}

module.exports = { normalizeSubject, resolveThreadKey };
