'use strict';

const mongoose = require('mongoose');
const { DEAL_STATUS, DEAL_STATUS_LIST, CURRENCIES } = require('../utils/constants');

const dealSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Deal title is required'],
      trim: true,
      maxlength: 140,
    },
    company: { type: String, trim: true, maxlength: 140, default: '' },
    contactName: { type: String, trim: true, maxlength: 120, default: '' },
    /** The primary contact's job title at the customer, e.g. "Head of Procurement". */
    contactDesignation: { type: String, trim: true, maxlength: 120, default: '' },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      validate: {
        validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Please provide a valid contact email address',
      },
    },
    contactPhone: { type: String, trim: true, maxlength: 40, default: '' },

    /**
     * Additional people on the deal beyond the primary contact above. Email sync
     * matches against all of these, and the Emails tab groups conversations by
     * whichever contact they belong to.
     */
    contacts: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, trim: true, maxlength: 120, default: '' },
            /** Job title at the customer — who this person is on the account. */
            designation: { type: String, trim: true, maxlength: 120, default: '' },
            email: { type: String, trim: true, lowercase: true, default: '' },
            phone: { type: String, trim: true, maxlength: 40, default: '' },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    /** Monetary value of the deal, stored in the smallest sane unit: whole currency units. */
    value: {
      type: Number,
      required: [true, 'Deal value is required'],
      min: [0, 'Deal value cannot be negative'],
      default: 0,
    },
    currency: {
      type: String,
      enum: CURRENCIES,
      default: 'USD',
      uppercase: true,
    },

    /**
     * Key of the Stage document this deal sits in. Not an enum: columns are
     * configurable at runtime, so the valid set lives in the stages collection
     * and is checked by stage.service on every write.
     */
    stage: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    /** Derived from the stage's outcome — see stage.service.applyStageToDeal. */
    status: {
      type: String,
      enum: DEAL_STATUS_LIST,
      default: DEAL_STATUS.OPEN,
      index: true,
    },
    /** Sort position inside its Kanban column. Lower renders first. */
    order: {
      type: Number,
      default: 0,
    },
    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    source: { type: String, trim: true, maxlength: 60, default: '' },
    description: { type: String, trim: true, maxlength: 4000, default: '' },

    expectedCloseDate: Date,
    closedAt: Date,
    lostReason: { type: String, trim: true, maxlength: 500, default: '' },

    archived: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Board reads are always "deals in a stage, in order" — index accordingly.
dealSchema.index({ archived: 1, stage: 1, order: 1 });
dealSchema.index({ owner: 1, status: 1 });
dealSchema.index({ title: 'text', company: 'text', contactName: 'text' });

/** Value discounted by the stage's win probability. */
dealSchema.virtual('weightedValue').get(function weightedValue() {
  return Math.round((this.value || 0) * ((this.probability || 0) / 100));
});

/*
 * Note: `status`, `probability` and `closedAt` are derived from the deal's stage,
 * but there is no hook for it here — the rules depend on the Stage document, so
 * `stage.service.applyStageToDeal()` owns that and every write path calls it.
 */

module.exports = mongoose.model('Deal', dealSchema);
