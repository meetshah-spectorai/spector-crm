'use strict';

const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const Deal = require('../models/Deal');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/activities — the shared team feed. */
const listActivities = asyncHandler(async (req, res) => {
  const { page, limit, type, deal, actor } = req.query;
  const filter = {};

  if (type) filter.type = type;
  if (actor) filter.actor = actor === 'me' ? req.user._id : new mongoose.Types.ObjectId(actor);
  if (deal) filter.deal = new mongoose.Types.ObjectId(deal);

  const [activities, total] = await Promise.all([
    Activity.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'name email')
      .populate({ path: 'deal', select: 'title company value currency stage' })
      .lean(),
    Activity.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: activities,
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/** GET /api/activities/deal/:id — the deal's full lifecycle timeline. */
const listDealActivities = asyncHandler(async (req, res) => {
  const deal = await Deal.findById(req.params.id).select('_id');
  if (!deal) throw ApiError.notFound('Deal not found');

  const activities = await Activity.find({ deal: deal._id })
    .sort({ createdAt: -1 })
    .limit(500)
    .populate('actor', 'name email')
    .lean();

  res.json({ success: true, data: activities });
});

module.exports = { listActivities, listDealActivities };
