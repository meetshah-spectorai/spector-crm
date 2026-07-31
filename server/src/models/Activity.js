'use strict';

const mongoose = require('mongoose');
const { ACTIVITY_TYPES } = require('../utils/constants');

/**
 * Append-only audit trail. Nothing in the app updates or deletes an activity —
 * the log is the deal's lifecycle history.
 */
const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
      index: true,
    },
    /** Human-readable one-liner, rendered directly in the timeline UI. */
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      default: null,
      index: true,
    },
    reminder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reminder',
      default: null,
    },
    /** Who caused the event. Null for system-generated events (scheduler). */
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorName: { type: String, default: 'System' },
    /** Field-level diffs and any extra context: { field, from, to, ... } */
    changes: {
      type: [
        new mongoose.Schema(
          {
            field: String,
            from: mongoose.Schema.Types.Mixed,
            to: mongoose.Schema.Types.Mixed,
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // createdAt is the event timestamp
    toJSON: { virtuals: true },
  }
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ deal: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
