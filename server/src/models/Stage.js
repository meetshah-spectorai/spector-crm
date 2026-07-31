'use strict';

const mongoose = require('mongoose');
const { STAGE_COLORS, STAGE_OUTCOMES } = require('../utils/constants');

/**
 * A configurable Kanban column.
 *
 * Stages live in the database rather than in code so the team can add and rename
 * their own columns. `key` is the stable identifier stored on every deal — it is
 * generated once from the label and then never changes, so renaming a column can
 * never orphan the deals sitting in it.
 */
const stageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_]+$/, 'Stage key may only contain lowercase letters, numbers and underscores'],
    },
    label: {
      type: String,
      required: [true, 'Column name is required'],
      trim: true,
      maxlength: 40,
    },
    /** Board position, ascending. Gaps are fine. */
    order: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    /** Default win probability for deals landing in this column. */
    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },
    /**
     * What reaching this column means for the deal:
     *   open → still in play
     *   won  → closed successfully (stamps closedAt, probability 100)
     *   lost → closed unsuccessfully (stamps closedAt, probability 0)
     */
    outcome: {
      type: String,
      enum: STAGE_OUTCOMES,
      default: 'open',
    },
    /** Palette token, resolved to Tailwind classes on the client. */
    color: {
      type: String,
      enum: STAGE_COLORS,
      default: 'slate',
    },
    /**
     * Marks the six columns created on first boot. They can be renamed and
     * recoloured like any other, but are flagged so future features (such as
     * delete) can protect the pipeline from being emptied entirely.
     */
    isDefault: {
      type: Boolean,
      default: false,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stageSchema.index({ order: 1, createdAt: 1 });

module.exports = mongoose.model('Stage', stageSchema);
