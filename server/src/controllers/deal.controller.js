'use strict';

const mongoose = require('mongoose');
const Deal = require('../models/Deal');
const Reminder = require('../models/Reminder');
const Activity = require('../models/Activity');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity, diffDeal } = require('../services/activity.service');
const stageService = require('../services/stage.service');
const { withDealVirtuals, withReminderVirtuals } = require('../utils/decorate');
const { REMINDER_STATUS, TRACKED_DEAL_FIELDS } = require('../utils/constants');

const OWNER_FIELDS = 'name email';
const ORDER_STEP = 1000;

const SORTS = {
  order: { stage: 1, order: 1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  value: { value: -1 },
  closeDate: { expectedCloseDate: 1 },
  title: { title: 1 },
};

/** Escapes regex metacharacters so "C++ (v2)" is a search, not a syntax error. */
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reads a column's display name out of a key → stage map, for log messages. */
const labelOf = (map, key) => (map.get(key) || { label: key }).label;

/**
 * Turns validated query params into a Mongo filter. The whole pipeline is shared,
 * so there is no row-level scoping — `owner` is a filter the user chooses, not a
 * restriction imposed on them.
 */
function buildDealFilter(query) {
  const filter = {};

  if (query.archived === 'true') filter.archived = true;
  else if (query.archived === 'false') filter.archived = false;

  if (query.stage) filter.stage = query.stage;
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.tag) filter.tags = query.tag;

  if (query.minValue !== undefined || query.maxValue !== undefined) {
    filter.value = {};
    if (query.minValue !== undefined) filter.value.$gte = query.minValue;
    if (query.maxValue !== undefined) filter.value.$lte = query.maxValue;
  }

  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ title: rx }, { company: rx }, { contactName: rx }, { contactEmail: rx }];
  }

  return filter;
}

/** Resolves an `owner` query param ("me" or an id) into a filter value. */
const resolveOwner = (owner, user) =>
  owner === 'me' ? user._id : new mongoose.Types.ObjectId(owner);

/**
 * Rewrites `order` for every deal in a stage so positions are evenly spaced.
 * Cheap at this scale and keeps the board deterministic.
 */
async function reindexStage(stage) {
  const deals = await Deal.find({ stage, archived: false })
    .sort({ order: 1, updatedAt: -1 })
    .select('_id')
    .lean();

  if (!deals.length) return;

  await Deal.bulkWrite(
    deals.map((d, i) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { order: i * ORDER_STEP } } },
    }))
  );
}

/** GET /api/deals */
const listDeals = asyncHandler(async (req, res) => {
  const { page, limit, sort } = req.query;
  const filter = buildDealFilter(req.query);
  if (req.query.owner) filter.owner = resolveOwner(req.query.owner, req.user);

  const [deals, total] = await Promise.all([
    Deal.find(filter)
      .sort(SORTS[sort] || SORTS.order)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', OWNER_FIELDS)
      .lean(),
    Deal.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: deals.map(withDealVirtuals),
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/**
 * GET /api/deals/board
 * Everything the Kanban board needs in one round trip: columns in pipeline
 * order, each with its deals sorted by position, plus per-column totals.
 */
const getBoard = asyncHandler(async (req, res) => {
  const filter = { archived: false };

  if (req.query.owner) filter.owner = resolveOwner(req.query.owner, req.user);
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ title: rx }, { company: rx }, { contactName: rx }];
  }

  const [stages, deals] = await Promise.all([
    stageService.listStages(),
    Deal.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .populate('owner', OWNER_FIELDS)
      .lean()
      .then((rows) => rows.map(withDealVirtuals)),
  ]);

  // Pending next action per deal, so cards can show a due badge.
  const pending = await Reminder.aggregate([
    {
      $match: {
        deal: { $in: deals.map((d) => d._id) },
        status: REMINDER_STATUS.PENDING,
      },
    },
    { $sort: { dueAt: 1 } },
    {
      $group: {
        _id: '$deal',
        count: { $sum: 1 },
        nextDueAt: { $first: '$dueAt' },
        nextTitle: { $first: '$title' },
      },
    },
  ]);
  const pendingByDeal = new Map(pending.map((p) => [String(p._id), p]));

  const columns = stages.map((stage) => {
    const stageDeals = deals
      .filter((d) => d.stage === stage.key)
      .map((d) => {
        const p = pendingByDeal.get(String(d._id));
        return {
          ...d,
          pendingReminders: p ? p.count : 0,
          nextAction: p ? { title: p.nextTitle, dueAt: p.nextDueAt } : null,
        };
      });

    return {
      _id: stage._id,
      key: stage.key,
      label: stage.label,
      probability: stage.probability,
      outcome: stage.outcome,
      color: stage.color,
      order: stage.order,
      deals: stageDeals,
      count: stageDeals.length,
      totalValue: stageDeals.reduce((sum, d) => sum + (d.value || 0), 0),
      weightedValue: stageDeals.reduce((sum, d) => sum + (d.weightedValue || 0), 0),
    };
  });

  // A deal whose column was removed would otherwise vanish from the board.
  const known = new Set(stages.map((s) => s.key));
  const orphaned = deals.filter((d) => !known.has(d.stage));

  res.json({ success: true, data: { columns, orphanedDeals: orphaned.length } });
});

/**
 * GET /api/deals/stats
 * Dashboard headline numbers for the whole shared pipeline. `tasks` is the
 * caller's own workload — that is the number they act on.
 */
const getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [stages, byStage, openAgg, wonThisMonth, lostThisMonth, taskCounts] = await Promise.all([
    stageService.listStages(),
    Deal.aggregate([
      { $match: { archived: false } },
      { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$value' } } },
    ]),
    Deal.aggregate([
      { $match: { archived: false, status: 'open' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          value: { $sum: '$value' },
          weighted: { $sum: { $multiply: ['$value', { $divide: ['$probability', 100] }] } },
        },
      },
    ]),
    Deal.aggregate([
      { $match: { status: 'won', closedAt: { $gte: monthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$value' } } },
    ]),
    Deal.aggregate([
      { $match: { status: 'lost', closedAt: { $gte: monthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$value' } } },
    ]),
    Reminder.aggregate([
      { $match: { status: REMINDER_STATUS.PENDING, assignedTo: req.user._id } },
      {
        $group: {
          _id: null,
          pending: { $sum: 1 },
          overdue: { $sum: { $cond: [{ $lt: ['$dueAt', now] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const first = (agg, fallback = {}) => agg[0] || fallback;
  const open = first(openAgg, { count: 0, value: 0, weighted: 0 });
  const won = first(wonThisMonth, { count: 0, value: 0 });
  const lost = first(lostThisMonth, { count: 0, value: 0 });
  const tasks = first(taskCounts, { pending: 0, overdue: 0 });

  const closedCount = won.count + lost.count;

  res.json({
    success: true,
    data: {
      pipeline: {
        openDeals: open.count,
        openValue: open.value,
        weightedValue: Math.round(open.weighted || 0),
      },
      thisMonth: {
        won: won.count,
        wonValue: won.value,
        lost: lost.count,
        lostValue: lost.value,
        winRate: closedCount ? Math.round((won.count / closedCount) * 100) : 0,
      },
      tasks: { pending: tasks.pending, overdue: tasks.overdue },
      byStage: stages.map((stage) => {
        const row = byStage.find((s) => s._id === stage.key);
        return {
          stage: stage.key,
          label: stage.label,
          outcome: stage.outcome,
          color: stage.color,
          count: row ? row.count : 0,
          value: row ? row.value : 0,
        };
      }),
    },
  });
});

/** GET /api/deals/:id */
const getDeal = asyncHandler(async (req, res) => {
  const deal = await Deal.findById(req.params.id)
    .populate('owner', OWNER_FIELDS)
    .populate('createdBy', OWNER_FIELDS);

  if (!deal) throw ApiError.notFound('Deal not found');

  const [activities, reminders] = await Promise.all([
    Activity.find({ deal: deal._id }).sort({ createdAt: -1 }).limit(100).lean(),
    Reminder.find({ deal: deal._id })
      .sort({ status: 1, dueAt: 1 })
      .populate('assignedTo', OWNER_FIELDS)
      .lean(),
  ]);

  res.json({
    success: true,
    data: { deal: deal.toJSON(), activities, reminders: reminders.map(withReminderVirtuals) },
  });
});

/** POST /api/deals */
const createDeal = asyncHandler(async (req, res) => {
  const { stage: stageKey, probability, ...payload } = req.body;

  if (payload.owner) {
    const owner = await User.findById(payload.owner).select('_id');
    if (!owner) throw ApiError.badRequest('Assigned owner does not exist');
  }

  // Falls back to the first column on the board rather than a hardcoded "lead".
  const stage = stageKey ? await stageService.resolveStage(stageKey) : await stageService.firstStage();

  // New cards land at the top of their column.
  const top = await Deal.findOne({ stage: stage.key, archived: false })
    .sort({ order: 1 })
    .select('order')
    .lean();

  const deal = new Deal({
    ...payload,
    owner: payload.owner || req.user._id,
    createdBy: req.user._id,
    order: top ? top.order - ORDER_STEP : 0,
  });

  if (probability !== undefined) deal.probability = probability;
  stageService.applyStageToDeal(deal, stage, { keepProbability: probability !== undefined });

  await deal.save();

  await logActivity({
    type: 'deal.created',
    message: `Created deal "${deal.title}" at ${stage.label} · ${deal.currency} ${deal.value.toLocaleString('en-US')}`,
    deal: deal._id,
    actor: req.user,
    meta: { stage: deal.stage, value: deal.value, currency: deal.currency },
  });

  await deal.populate('owner', OWNER_FIELDS);
  res.status(201).json({ success: true, data: deal.toJSON() });
});

/** PATCH /api/deals/:id */
const updateDeal = asyncHandler(async (req, res) => {
  const deal = await Deal.findById(req.params.id);
  if (!deal) throw ApiError.notFound('Deal not found');

  const before = deal.toObject();

  if (req.body.owner !== undefined) {
    const owner = await User.findById(req.body.owner).select('_id');
    if (!owner) throw ApiError.badRequest('Assigned owner does not exist');
  }

  const stageChanged = req.body.stage !== undefined && req.body.stage !== deal.stage;
  const stage = stageChanged ? await stageService.resolveStage(req.body.stage) : null;

  // Whitelist: only fields we track are assignable, so no mass-assignment.
  Object.entries(req.body).forEach(([key, value]) => {
    if (key !== 'status' && key !== 'stage' && TRACKED_DEAL_FIELDS.includes(key)) {
      deal[key] = value;
    }
  });

  if (stage) {
    stageService.applyStageToDeal(deal, stage, {
      keepProbability: req.body.probability !== undefined,
    });
    // Moving via the edit form should also put the card at the top of its column.
    const top = await Deal.findOne({ stage: deal.stage, archived: false })
      .sort({ order: 1 })
      .select('order')
      .lean();
    deal.order = top ? top.order - ORDER_STEP : 0;
  }

  await deal.save();

  const stageNames = await stageService.stageMap();
  const changes = diffDeal(before, deal.toObject());
  if (changes.length) {
    const summary = changes
      .map((c) => {
        if (c.field === 'stage') {
          return `stage ${labelOf(stageNames, c.from)} → ${labelOf(stageNames, c.to)}`;
        }
        if (c.field === 'value') return `value ${before.currency} ${Number(c.from).toLocaleString('en-US')} → ${deal.currency} ${Number(c.to).toLocaleString('en-US')}`;
        return c.field;
      })
      .join(', ');

    await logActivity({
      type: changes.some((c) => c.field === 'stage')
        ? 'deal.stage_changed'
        : changes.some((c) => c.field === 'value')
          ? 'deal.value_changed'
          : changes.some((c) => c.field === 'owner')
            ? 'deal.owner_changed'
            : 'deal.updated',
      message: `Updated ${summary}`.slice(0, 500),
      deal: deal._id,
      actor: req.user,
      changes,
    });
  }

  await deal.populate('owner', OWNER_FIELDS);
  res.json({ success: true, data: deal.toJSON() });
});

/**
 * PATCH /api/deals/:id/move
 * Drag-and-drop endpoint: sets the stage and the position within the column.
 */
const moveDeal = asyncHandler(async (req, res) => {
  const { stage: stageKey, index, lostReason } = req.body;

  const deal = await Deal.findById(req.params.id);
  if (!deal) throw ApiError.notFound('Deal not found');
  if (deal.archived) throw ApiError.badRequest('Restore the deal before moving it');

  const stage = await stageService.resolveStage(stageKey);
  const fromStage = deal.stage;

  // Siblings already in the destination column, excluding this deal.
  const siblings = await Deal.find({
    stage: stage.key,
    archived: false,
    _id: { $ne: deal._id },
  })
    .sort({ order: 1 })
    .select('_id order')
    .lean();

  const clamped = Math.min(index, siblings.length);
  const prev = clamped > 0 ? siblings[clamped - 1] : null;
  const next = clamped < siblings.length ? siblings[clamped] : null;

  let order;
  if (!prev && !next) order = 0;
  else if (!prev) order = next.order - ORDER_STEP;
  else if (!next) order = prev.order + ORDER_STEP;
  else order = (prev.order + next.order) / 2;

  stageService.applyStageToDeal(deal, stage);
  deal.order = order;
  if (stage.outcome === 'lost' && lostReason !== undefined) deal.lostReason = lostReason;
  await deal.save();

  // Fractional gaps eventually collapse; re-space when they get too tight.
  if (prev && next && Math.abs(next.order - prev.order) < 2) {
    await reindexStage(stage.key);
  }

  if (fromStage !== stage.key) {
    const stageNames = await stageService.stageMap();
    await logActivity({
      type: 'deal.stage_changed',
      message: `Moved "${deal.title}" from ${labelOf(stageNames, fromStage)} to ${stage.label}`,
      deal: deal._id,
      actor: req.user,
      changes: [{ field: 'stage', from: fromStage, to: stage.key }],
      meta: { status: deal.status },
    });

    if (deal.status !== 'open') {
      await logActivity({
        type: 'deal.status_changed',
        message: `Deal marked as ${deal.status.toUpperCase()} · ${deal.currency} ${deal.value.toLocaleString('en-US')}`,
        deal: deal._id,
        actor: req.user,
        changes: [{ field: 'status', from: 'open', to: deal.status }],
      });
    }
  }

  const fresh = await Deal.findById(deal._id).populate('owner', OWNER_FIELDS);
  res.json({ success: true, data: fresh.toJSON() });
});

/** POST /api/deals/:id/notes — a note is an activity entry, nothing more. */
const addNote = asyncHandler(async (req, res) => {
  const deal = await Deal.findById(req.params.id).select('_id title');
  if (!deal) throw ApiError.notFound('Deal not found');

  const activity = await logActivity({
    type: 'note.added',
    message: req.body.note,
    deal: deal._id,
    actor: req.user,
  });

  res.status(201).json({ success: true, data: activity });
});

/** Shared handler for PATCH /:id/archive and PATCH /:id/restore. */
const setArchived = (archived) =>
  asyncHandler(async (req, res) => {
    const deal = await Deal.findById(req.params.id);
    if (!deal) throw ApiError.notFound('Deal not found');

    deal.archived = archived;
    await deal.save();

    if (archived) {
      // Archiving a deal should not leave orphaned tasks on anyone's to-do list.
      await Reminder.updateMany(
        { deal: deal._id, status: REMINDER_STATUS.PENDING },
        { $set: { status: REMINDER_STATUS.CANCELLED } }
      );
    }

    await logActivity({
      type: archived ? 'deal.archived' : 'deal.restored',
      message: `${archived ? 'Archived' : 'Restored'} "${deal.title}"`,
      deal: deal._id,
      actor: req.user,
    });

    await deal.populate('owner', OWNER_FIELDS);
    res.json({ success: true, data: deal.toJSON() });
  });

const archiveDeal = setArchived(true);
const restoreDeal = setArchived(false);

/**
 * DELETE /api/deals/:id — hard delete.
 * Reminders go with it; the activity log survives as a record.
 */
const deleteDeal = asyncHandler(async (req, res) => {
  const deal = await Deal.findById(req.params.id);
  if (!deal) throw ApiError.notFound('Deal not found');

  await Reminder.deleteMany({ deal: deal._id });
  await deal.deleteOne();

  await logActivity({
    type: 'deal.deleted',
    message: `Deleted deal "${deal.title}"`,
    actor: req.user,
    meta: { dealId: String(deal._id), title: deal.title, value: deal.value },
  });

  res.json({ success: true, message: 'Deal deleted' });
});

module.exports = {
  listDeals,
  getBoard,
  getStats,
  getDeal,
  createDeal,
  updateDeal,
  moveDeal,
  addNote,
  archiveDeal,
  restoreDeal,
  deleteDeal,
};
