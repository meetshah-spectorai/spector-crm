'use strict';

const Activity = require('../models/Activity');
const logger = require('../utils/logger');
const { TRACKED_DEAL_FIELDS } = require('../utils/constants');

/**
 * Writes one entry to the activity log.
 *
 * Logging must never break the request that triggered it, so failures are
 * swallowed and reported rather than thrown.
 */
async function logActivity({ type, message, deal, reminder, actor, changes = [], meta = {} }) {
  try {
    return await Activity.create({
      type,
      message,
      deal: deal || null,
      reminder: reminder || null,
      actor: actor ? actor._id : null,
      actorName: actor ? actor.name : 'System',
      changes,
      meta,
    });
  } catch (err) {
    logger.error('Failed to write activity log:', err.message, { type, message });
    return null;
  }
}

const isEqual = (a, b) => {
  if (a instanceof Date || b instanceof Date) {
    const at = a ? new Date(a).getTime() : null;
    const bt = b ? new Date(b).getTime() : null;
    return at === bt;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
  }
  if (a && b && a.toString && b.toString && (a._bsontype || b._bsontype)) {
    return a.toString() === b.toString();
  }
  return String(a ?? '') === String(b ?? '');
};

/**
 * Diffs a deal against a snapshot of its previous state and returns the changed
 * tracked fields. Used to build precise "X changed from A to B" log entries.
 */
function diffDeal(before, after) {
  const changes = [];
  for (const field of TRACKED_DEAL_FIELDS) {
    const from = before[field];
    const to = after[field];
    if (!isEqual(from, to)) {
      changes.push({
        field,
        from: from === undefined ? null : from,
        to: to === undefined ? null : to,
      });
    }
  }
  return changes;
}

module.exports = { logActivity, diffDeal };
