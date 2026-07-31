'use strict';

const Stage = require('../models/Stage');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const {
  DEFAULT_STAGES,
  STAGE_COLORS,
  DEAL_STATUS,
} = require('../utils/constants');

const ORDER_STEP = 100;

/**
 * Turns a column name into a stable key: "Proposal Sent" → "proposal_sent".
 * Keys are generated once at creation and never change afterwards.
 */
function slugify(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

/** Appends a counter until the key is free, so two "Won" columns can coexist. */
async function uniqueKey(label) {
  const base = slugify(label) || 'stage';
  let candidate = base;
  let n = 2;
  /* eslint-disable no-await-in-loop */
  while (await Stage.exists({ key: candidate })) {
    candidate = `${base}_${n}`;
    n += 1;
  }
  /* eslint-enable no-await-in-loop */
  return candidate;
}

/**
 * Creates the default board the first time the app runs against a database.
 * Idempotent: it only inserts stages whose key is missing, so an existing board
 * is never modified.
 */
async function ensureDefaultStages() {
  const existing = await Stage.countDocuments();
  if (existing > 0) return [];

  const docs = DEFAULT_STAGES.map((stage, i) => ({
    ...stage,
    order: i * ORDER_STEP,
    isDefault: true,
  }));

  const created = await Stage.insertMany(docs);
  logger.info(`Created ${created.length} default pipeline stages`);
  return created;
}

/** All stages in board order. */
function listStages() {
  return Stage.find({}).sort({ order: 1, createdAt: 1 }).lean();
}

/** Map of key → stage, for label lookups and validation. */
async function stageMap() {
  const stages = await listStages();
  return new Map(stages.map((s) => [s.key, s]));
}

/** Resolves a stage key, rejecting anything that is not a real column. */
async function resolveStage(key) {
  const stage = await Stage.findOne({ key }).lean();
  if (!stage) throw ApiError.badRequest(`"${key}" is not a pipeline stage`);
  return stage;
}

/** The first column on the board — where a deal goes when none is specified. */
async function firstStage() {
  const stage = await Stage.findOne({}).sort({ order: 1, createdAt: 1 }).lean();
  if (!stage) throw ApiError.badRequest('The pipeline has no stages yet');
  return stage;
}

/**
 * Writes a stage and everything derived from it onto a deal document.
 *
 * This is the single place that keeps `status`, `probability` and `closedAt`
 * consistent with the column a deal sits in. The Deal model deliberately has no
 * hook for this: the rules depend on the stage document, which only a query can
 * provide.
 *
 * @param {boolean} keepProbability - true when the caller set an explicit
 *   probability that should survive the stage change.
 */
function applyStageToDeal(deal, stage, { keepProbability = false } = {}) {
  deal.stage = stage.key;

  if (stage.outcome === 'won') {
    deal.status = DEAL_STATUS.WON;
    deal.closedAt = deal.closedAt || new Date();
    deal.probability = 100;
    return deal;
  }

  if (stage.outcome === 'lost') {
    deal.status = DEAL_STATUS.LOST;
    deal.closedAt = deal.closedAt || new Date();
    deal.probability = 0;
    return deal;
  }

  deal.status = DEAL_STATUS.OPEN;
  deal.closedAt = undefined;
  if (!keepProbability) deal.probability = stage.probability;
  return deal;
}

/** Next colour in the palette, cycling so new columns look distinct. */
function colorForIndex(index) {
  return STAGE_COLORS[index % STAGE_COLORS.length];
}

/** Order value that places a new stage at the end of the board. */
async function nextOrder() {
  const last = await Stage.findOne({}).sort({ order: -1 }).select('order').lean();
  return last ? last.order + ORDER_STEP : 0;
}

module.exports = {
  ORDER_STEP,
  slugify,
  uniqueKey,
  ensureDefaultStages,
  listStages,
  stageMap,
  resolveStage,
  firstStage,
  applyStageToDeal,
  colorForIndex,
  nextOrder,
};
