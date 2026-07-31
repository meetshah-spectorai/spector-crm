'use strict';

const Deal = require('../../models/Deal');

/**
 * Index of "every contact address the CRM knows" → the deals it belongs to.
 *
 * The sync engine uses this to decide which messages are worth storing: if none
 * of a message's participants is a CRM contact, it is skipped entirely. That
 * keeps a connected mailbox from dumping unrelated personal mail into the
 * database, and keeps the collection proportional to the pipeline.
 */

const normalize = (email) => String(email || '').trim().toLowerCase();

/** Every address attached to a deal: the primary contact plus any extras. */
function dealContactEmails(deal) {
  const emails = [deal.contactEmail, ...(deal.contacts || []).map((c) => c.email)]
    .map(normalize)
    .filter(Boolean);
  return [...new Set(emails)];
}

/** Display name for an address on a deal, falling back to the address itself. */
function dealContactName(deal, email) {
  const target = normalize(email);
  if (normalize(deal.contactEmail) === target && deal.contactName) return deal.contactName;
  const extra = (deal.contacts || []).find((c) => normalize(c.email) === target);
  if (extra?.name) return extra.name;
  return email;
}

/**
 * Builds Map<address, Array<{ dealId, dealTitle, contactName }>>.
 * Archived deals are included: their history should still be readable.
 */
async function buildContactIndex() {
  const deals = await Deal.find({})
    .select('_id title contactEmail contactName contacts')
    .lean();

  const index = new Map();
  for (const deal of deals) {
    for (const email of dealContactEmails(deal)) {
      if (!index.has(email)) index.set(email, []);
      index.get(email).push({
        dealId: deal._id,
        dealTitle: deal.title,
        contactName: dealContactName(deal, email),
      });
    }
  }
  return index;
}

/**
 * Matches a message's participants against the index.
 * Returns { dealLinks, matches } — dealLinks goes straight onto the document.
 */
function matchParticipants(index, participants) {
  const dealLinks = [];
  const matches = [];
  const seen = new Set();

  for (const address of participants) {
    const hits = index.get(normalize(address));
    if (!hits) continue;
    for (const hit of hits) {
      const dedupeKey = `${hit.dealId}|${address}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      dealLinks.push({ deal: hit.dealId, contactEmail: normalize(address) });
      matches.push({ ...hit, contactEmail: normalize(address) });
    }
  }

  return { dealLinks, matches };
}

module.exports = {
  normalize,
  dealContactEmails,
  dealContactName,
  buildContactIndex,
  matchParticipants,
};
