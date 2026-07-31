'use strict';

const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const Deal = require('../models/Deal');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { logActivity } = require('../services/activity.service');
const { sendReminderAssignedEmail } = require('../services/email.service');
const { REMINDER_STATUS } = require('../utils/constants');
const { withReminderVirtuals } = require('../utils/decorate');

const USER_FIELDS = 'name email';
const DEAL_FIELDS = 'title company value currency stage status owner';

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
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const SORTS = {
  dueAt: { dueAt: 1 },
  dueAtDesc: { dueAt: -1 },
  created: { createdAt: -1 },
  priority: { priority: -1, dueAt: 1 },
};

/**
 * Tasks are shared like everything else: `assignedTo` is a filter the user picks,
 * defaulting to their own list because that is the one they act on.
 */
function buildReminderFilter(query, user) {
  const filter = {};

  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.deal) filter.deal = new mongoose.Types.ObjectId(query.deal);

  if (query.assignedTo) {
    filter.assignedTo =
      query.assignedTo === 'me' ? user._id : new mongoose.Types.ObjectId(query.assignedTo);
  }

  const now = new Date();
  if (query.due === 'overdue') filter.dueAt = { $lt: now };
  else if (query.due === 'today') filter.dueAt = { $gte: startOfToday(), $lte: endOfToday() };
  else if (query.due === 'week') filter.dueAt = { $gte: startOfToday(), $lte: daysFromNow(7) };
  else if (query.due === 'upcoming') filter.dueAt = { $gt: now };

  return filter;
}

/**
 * Urgency buckets for the whole filtered set, not just the requested page — the
 * client uses these for headline counts and the sidebar badge, so they must not
 * change with `limit`.
 */
async function countBuckets(filter) {
  const now = new Date();
  const todayEnd = endOfToday();
  const weekEnd = daysFromNow(7);

  const [row] = await Reminder.aggregate([
    { $match: { ...filter, status: REMINDER_STATUS.PENDING } },
    {
      $group: {
        _id: null,
        pending: { $sum: 1 },
        overdue: { $sum: { $cond: [{ $lt: ['$dueAt', now] }, 1, 0] } },
        today: {
          $sum: {
            $cond: [{ $and: [{ $gte: ['$dueAt', now] }, { $lte: ['$dueAt', todayEnd] }] }, 1, 0],
          },
        },
        thisWeek: {
          $sum: {
            $cond: [{ $and: [{ $gt: ['$dueAt', todayEnd] }, { $lte: ['$dueAt', weekEnd] }] }, 1, 0],
          },
        },
        later: { $sum: { $cond: [{ $gt: ['$dueAt', weekEnd] }, 1, 0] } },
      },
    },
    { $project: { _id: 0 } },
  ]);

  return row || { pending: 0, overdue: 0, today: 0, thisWeek: 0, later: 0 };
}

/**
 * GET /api/reminders
 * The centralized to-do list: a page of reminders plus whole-set urgency counts.
 */
const listReminders = asyncHandler(async (req, res) => {
  const { page, limit, sort } = req.query;
  const filter = buildReminderFilter(req.query, req.user);

  const [rows, total, counts] = await Promise.all([
    Reminder.find(filter)
      .sort(SORTS[sort] || SORTS.dueAt)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('assignedTo', USER_FIELDS)
      .populate('createdBy', USER_FIELDS)
      .populate({ path: 'deal', select: DEAL_FIELDS })
      .lean(),
    Reminder.countDocuments(filter),
    countBuckets(filter),
  ]);

  res.json({
    success: true,
    data: rows.map(withReminderVirtuals),
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
      counts,
    },
  });
});

/** GET /api/reminders/:id */
const getReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findById(req.params.id)
    .populate('assignedTo', USER_FIELDS)
    .populate('createdBy', USER_FIELDS)
    .populate({ path: 'deal', select: DEAL_FIELDS });

  if (!reminder) throw ApiError.notFound('Reminder not found');

  res.json({ success: true, data: withReminderVirtuals(reminder.toObject()) });
});

/** POST /api/reminders */
const createReminder = asyncHandler(async (req, res) => {
  const { deal: dealId, assignedTo, ...rest } = req.body;

  const deal = await Deal.findById(dealId).select('_id title owner value currency stage');
  if (!deal) throw ApiError.badRequest('The deal does not exist');

  const assigneeId = assignedTo || deal.owner;
  const assignee = await User.findById(assigneeId).select('name email notificationPrefs');
  if (!assignee) throw ApiError.badRequest('Assignee does not exist');

  const reminder = await Reminder.create({
    ...rest,
    deal: deal._id,
    assignedTo: assignee._id,
    createdBy: req.user._id,
  });

  await logActivity({
    type: 'reminder.created',
    message: `Next action set: "${reminder.title}" for ${assignee.name}, due ${reminder.dueAt.toISOString()}`,
    deal: deal._id,
    reminder: reminder._id,
    actor: req.user,
    meta: { dueAt: reminder.dueAt, assignedTo: String(assignee._id) },
  });

  // Only ping the assignee if someone else created the task for them.
  const assignedToSomeoneElse = String(assignee._id) !== String(req.user._id);
  if (assignedToSomeoneElse && reminder.emailNotify && assignee.notificationPrefs.emailReminders) {
    sendReminderAssignedEmail({
      user: assignee,
      reminder,
      deal,
      actor: req.user,
    }).catch((err) => logger.error('Assignment email failed:', err.message));
  }

  await reminder.populate([
    { path: 'assignedTo', select: USER_FIELDS },
    { path: 'deal', select: DEAL_FIELDS },
  ]);

  res.status(201).json({ success: true, data: withReminderVirtuals(reminder.toObject()) });
});

/** PATCH /api/reminders/:id */
const updateReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) throw ApiError.notFound('Reminder not found');

  const before = reminder.toObject();

  if (req.body.assignedTo !== undefined) {
    const assignee = await User.findById(req.body.assignedTo).select('_id');
    if (!assignee) throw ApiError.badRequest('Assignee does not exist');
  }

  Object.assign(reminder, req.body);

  // A rescheduled task must be eligible for a fresh notification.
  if (req.body.dueAt && new Date(req.body.dueAt).getTime() !== before.dueAt.getTime()) {
    reminder.notifiedAt = null;
  }

  if (req.body.status === REMINDER_STATUS.COMPLETED && before.status !== REMINDER_STATUS.COMPLETED) {
    reminder.completedAt = new Date();
    reminder.completedBy = req.user._id;
  }
  if (req.body.status === REMINDER_STATUS.PENDING) {
    reminder.completedAt = undefined;
    reminder.completedBy = undefined;
  }

  await reminder.save();

  const statusChanged = req.body.status && req.body.status !== before.status;
  const type =
    statusChanged && req.body.status === REMINDER_STATUS.COMPLETED
      ? 'reminder.completed'
      : statusChanged && req.body.status === REMINDER_STATUS.CANCELLED
        ? 'reminder.cancelled'
        : 'reminder.updated';

  const message =
    type === 'reminder.completed'
      ? `Completed next action: "${reminder.title}"`
      : type === 'reminder.cancelled'
        ? `Cancelled next action: "${reminder.title}"`
        : `Updated next action: "${reminder.title}"`;

  await logActivity({
    type,
    message,
    deal: reminder.deal,
    reminder: reminder._id,
    actor: req.user,
    changes: Object.keys(req.body).map((field) => ({
      field,
      from: before[field] === undefined ? null : before[field],
      to: reminder[field] === undefined ? null : reminder[field],
    })),
  });

  await reminder.populate([
    { path: 'assignedTo', select: USER_FIELDS },
    { path: 'deal', select: DEAL_FIELDS },
  ]);

  res.json({ success: true, data: withReminderVirtuals(reminder.toObject()) });
});

/** POST /api/reminders/:id/complete — the one-click action on the to-do list. */
const completeReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) throw ApiError.notFound('Reminder not found');

  if (reminder.status === REMINDER_STATUS.COMPLETED) {
    throw ApiError.badRequest('This task is already completed');
  }

  reminder.status = REMINDER_STATUS.COMPLETED;
  reminder.completedAt = new Date();
  reminder.completedBy = req.user._id;
  await reminder.save();

  await logActivity({
    type: 'reminder.completed',
    message: `Completed next action: "${reminder.title}"`,
    deal: reminder.deal,
    reminder: reminder._id,
    actor: req.user,
  });

  await reminder.populate([
    { path: 'assignedTo', select: USER_FIELDS },
    { path: 'deal', select: DEAL_FIELDS },
  ]);

  res.json({ success: true, data: withReminderVirtuals(reminder.toObject()) });
});

/** DELETE /api/reminders/:id */
const deleteReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) throw ApiError.notFound('Reminder not found');

  await reminder.deleteOne();

  await logActivity({
    type: 'reminder.deleted',
    message: `Deleted next action: "${reminder.title}"`,
    deal: reminder.deal,
    actor: req.user,
  });

  res.json({ success: true, message: 'Reminder deleted' });
});

module.exports = {
  listReminders,
  getReminder,
  createReminder,
  updateReminder,
  completeReminder,
  deleteReminder,
};
