'use strict';

const mongoose = require('mongoose');

/**
 * A free-text note on a deal — the running log of what was said and agreed.
 * Notes are shared like everything else on a deal; `author` records who wrote it.
 */
const noteSchema = new mongoose.Schema(
  {
    body: {
      type: String,
      required: [true, 'Note text is required'],
      trim: true,
      maxlength: 5000,
    },

    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Set the first time the body changes, so the UI can show "edited". */
    editedAt: { type: Date, default: null },

    /** Sticks the note to the top of the deal's timeline. */
    pinned: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// The deal timeline's only query: pinned first, newest first.
noteSchema.index({ deal: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
