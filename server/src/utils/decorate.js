'use strict';

const { REMINDER_STATUS } = require('./constants');

/**
 * Mongoose does not evaluate virtuals on `.lean()` results (that needs the
 * mongoose-lean-virtuals plugin), so lean reads get the same computed fields
 * added explicitly here. Keeps the API response shape identical whether a
 * handler used lean or hydrated documents.
 */
const withDealVirtuals = (deal) =>
  deal && {
    ...deal,
    weightedValue: Math.round((deal.value || 0) * ((deal.probability || 0) / 100)),
  };

const withReminderVirtuals = (reminder) => {
  if (!reminder) return reminder;
  const dueAt = reminder.dueAt ? new Date(reminder.dueAt) : null;
  return {
    ...reminder,
    isOverdue: reminder.status === REMINDER_STATUS.PENDING && dueAt ? dueAt < new Date() : false,
    notifyAt: dueAt
      ? new Date(dueAt.getTime() - (reminder.notifyBeforeMinutes || 0) * 60_000)
      : null,
  };
};

module.exports = { withDealVirtuals, withReminderVirtuals };
