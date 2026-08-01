'use strict';

const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const config = require('../config/env');
const logger = require('../utils/logger');
const { REMINDER_STATUS } = require('../utils/constants');
const { sendReminderDueEmail, sendDailyDigestEmail } = require('../services/email.service');

const DEAL_FIELDS = 'title company value currency stage status';
const MINUTE = 60 * 1000;

/** Guards against overlapping runs if a pass takes longer than the interval. */
let dueSweepRunning = false;

/**
 * Every minute: find pending reminders whose notify time has arrived and which
 * have not been emailed yet, then send one email each.
 *
 * `notifiedAt` is claimed *before* sending — a crash mid-batch therefore risks a
 * missed email rather than a duplicate one, which is the better failure mode for
 * notifications.
 */
async function sweepDueReminders() {
  if (dueSweepRunning) return { sent: 0, skipped: 'overlapping run' };
  dueSweepRunning = true;

  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + config.REMINDER_LEAD_MINUTES * MINUTE);

    const candidates = await Reminder.find({
      status: REMINDER_STATUS.PENDING,
      emailNotify: true,
      notifiedAt: null,
      dueAt: { $lte: horizon },
    })
      .limit(200)
      .populate('assignedTo', 'name email notificationPrefs')
      .populate({ path: 'deal', select: DEAL_FIELDS });

    if (!candidates.length) return { sent: 0 };

    let sent = 0;

    for (const reminder of candidates) {
      // Respect each reminder's own lead time as well as the global horizon.
      const notifyAt = new Date(reminder.dueAt.getTime() - reminder.notifyBeforeMinutes * MINUTE);
      if (notifyAt > now) continue;

      const user = reminder.assignedTo;
      if (!user || !user.notificationPrefs.emailReminders) {
        // Mark as handled so we stop re-examining it every minute.
        reminder.notifiedAt = now;
        await reminder.save({ validateBeforeSave: false });
        continue;
      }

      reminder.notifiedAt = now;
      await reminder.save({ validateBeforeSave: false });

      const ok = await sendReminderDueEmail({ user, reminder, deal: reminder.deal });
      if (ok) sent += 1;
    }

    if (sent) logger.info(`Reminder sweep: ${sent} notification(s) sent`);
    return { sent };
  } catch (err) {
    logger.error('Reminder sweep failed:', err.message);
    return { sent: 0, error: err.message };
  } finally {
    dueSweepRunning = false;
  }
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Daily digest: one email per user summarising overdue tasks, today's tasks and
 * the coming week. Users with an empty list are skipped.
 */
async function sendDailyDigests() {
  try {
    const users = await User.find({ 'notificationPrefs.dailyDigest': true }).select(
      'name email notificationPrefs'
    );

    const now = new Date();
    const todayEnd = endOfToday();
    const weekEnd = new Date(startOfToday().getTime() + 7 * 24 * 60 * MINUTE);

    let sent = 0;

    for (const user of users) {
      const pending = await Reminder.find({
        assignedTo: user._id,
        status: REMINDER_STATUS.PENDING,
        dueAt: { $lte: weekEnd },
      })
        .sort({ dueAt: 1 })
        .limit(50)
        .populate({ path: 'deal', select: DEAL_FIELDS })
        .lean();

      const overdue = pending.filter((r) => new Date(r.dueAt) < now);
      const today = pending.filter(
        (r) => new Date(r.dueAt) >= now && new Date(r.dueAt) <= todayEnd
      );
      const upcoming = pending.filter((r) => new Date(r.dueAt) > todayEnd);

      if (!overdue.length && !today.length) continue; // nothing worth an email

      const ok = await sendDailyDigestEmail({ user, overdue, today, upcoming });
      if (ok) sent += 1;
    }

    logger.info(`Daily digest: ${sent} email(s) sent to ${users.length} eligible user(s)`);
    return { sent };
  } catch (err) {
    logger.error('Daily digest failed:', err.message);
    return { sent: 0, error: err.message };
  }
}

const tasks = [];

/** Registers the cron jobs. Call once, after the DB connection is up. */
function startScheduler() {
  if (!config.ENABLE_SCHEDULER) {
    logger.warn('Scheduler disabled (ENABLE_SCHEDULER=false)');
    return;
  }

  tasks.push(
    cron.schedule('* * * * *', sweepDueReminders, { timezone: config.DIGEST_TIMEZONE })
  );
  logger.info(`Reminder sweep scheduled every minute (lead ${config.REMINDER_LEAD_MINUTES}m)`);

  if (config.ENABLE_DAILY_DIGEST) {
    tasks.push(
      cron.schedule(config.DAILY_DIGEST_CRON, sendDailyDigests, {
        timezone: config.DIGEST_TIMEZONE,
      })
    );
    logger.info(
      `Daily digest scheduled "${config.DAILY_DIGEST_CRON}" (${config.DIGEST_TIMEZONE})`
    );
  }
}

function stopScheduler() {
  tasks.forEach((t) => t.stop());
  tasks.length = 0;
}

module.exports = { startScheduler, stopScheduler, sweepDueReminders, sendDailyDigests };
