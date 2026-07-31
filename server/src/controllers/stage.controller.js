'use strict';

const Stage = require('../models/Stage');
const Deal = require('../models/Deal');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activity.service');
const stageService = require('../services/stage.service');

/** Adds the live deal count to each column, so the UI can warn before changes. */
async function withDealCounts(stages) {
  const counts = await Deal.aggregate([
    { $match: { archived: false } },
    { $group: { _id: '$stage', count: { $sum: 1 } } },
  ]);
  const byStage = new Map(counts.map((c) => [c._id, c.count]));
  return stages.map((s) => ({ ...s, dealCount: byStage.get(s.key) || 0 }));
}

/** GET /api/stages */
const listStages = asyncHandler(async (req, res) => {
  const stages = await stageService.listStages();
  res.json({ success: true, data: await withDealCounts(stages) });
});

/**
 * POST /api/stages — add a column.
 * The key is generated from the label and is immutable from then on.
 */
const createStage = asyncHandler(async (req, res) => {
  const { label, probability, outcome, color } = req.body;

  const count = await Stage.countDocuments();
  const stage = await Stage.create({
    key: await stageService.uniqueKey(label),
    label,
    outcome: outcome || 'open',
    probability: probability ?? (outcome === 'won' ? 100 : outcome === 'lost' ? 0 : 10),
    color: color || stageService.colorForIndex(count),
    order: await stageService.nextOrder(),
    createdBy: req.user._id,
  });

  await logActivity({
    type: 'stage.created',
    message: `Added pipeline column "${stage.label}"`,
    actor: req.user,
    meta: { stageKey: stage.key, outcome: stage.outcome },
  });

  res.status(201).json({ success: true, data: { ...stage.toObject(), dealCount: 0 } });
});

/**
 * PATCH /api/stages/:id — rename or restyle a column.
 * `key` is never touched, so the deals already in this column stay put.
 */
const updateStage = asyncHandler(async (req, res) => {
  const stage = await Stage.findById(req.params.id);
  if (!stage) throw ApiError.notFound('Column not found');

  const before = { label: stage.label, probability: stage.probability, outcome: stage.outcome };
  const changes = [];

  if (req.body.label !== undefined && req.body.label !== stage.label) {
    changes.push({ field: 'label', from: stage.label, to: req.body.label });
    stage.label = req.body.label;
  }
  if (req.body.probability !== undefined && req.body.probability !== stage.probability) {
    changes.push({ field: 'probability', from: stage.probability, to: req.body.probability });
    stage.probability = req.body.probability;
  }
  if (req.body.outcome !== undefined && req.body.outcome !== stage.outcome) {
    changes.push({ field: 'outcome', from: stage.outcome, to: req.body.outcome });
    stage.outcome = req.body.outcome;
  }
  if (req.body.color !== undefined) stage.color = req.body.color;

  await stage.save();

  // Changing what a column *means* has to be pushed onto the deals sitting in it,
  // otherwise their status would silently disagree with the board.
  let resynced = 0;
  if (changes.some((c) => c.field === 'outcome')) {
    const deals = await Deal.find({ stage: stage.key });
    for (const deal of deals) {
      stageService.applyStageToDeal(deal, stage.toObject());
      await deal.save();
      resynced += 1;
    }
  }

  if (changes.length) {
    await logActivity({
      type: 'stage.updated',
      message:
        changes.some((c) => c.field === 'label')
          ? `Renamed pipeline column "${before.label}" to "${stage.label}"`
          : `Updated pipeline column "${stage.label}"`,
      actor: req.user,
      changes,
      meta: { stageKey: stage.key, dealsResynced: resynced },
    });
  }

  const dealCount = await Deal.countDocuments({ stage: stage.key, archived: false });
  res.json({ success: true, data: { ...stage.toObject(), dealCount } });
});

module.exports = { listStages, createStage, updateStage };
