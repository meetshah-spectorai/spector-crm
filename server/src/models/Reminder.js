'use strict';

const mongoose = require('mongoose');
const { REMINDER_STATUS, REMINDER_STATUS_LIST, PRIORITIES } = require('../utils/constants');

/**
 * The "next action" on a deal. Pending reminders across all deals make up the
 * centralized to-do list; the scheduler emails their assignees when due.
 */
const reminderSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Reminder title is required'],
      trim: true,
      maxlength: 160,
    },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },

    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      required: true,
      index: true,
    },
    assignedTo: {
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

    dueAt: {
      type: Date,
      required: [true, 'A due date is required'],
      index: true,
    },
    status: {
      type: String,
      enum: REMINDER_STATUS_LIST,
      default: REMINDER_STATUS.PENDING,
      index: true,
    },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: 'medium',
    },

    completedAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /** Send the reminder email this many minutes before dueAt. */
    notifyBeforeMinutes: {
      type: Number,
      min: 0,
      max: 60 * 24 * 14,
      default: 30,
    },
    emailNotify: { type: Boolean, default: true },
    /** Set once the due-soon email goes out, so it is never sent twice. */
    notifiedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// The scheduler's hot query: pending + email-enabled + not yet notified, by dueAt.
reminderSchema.index({ status: 1, emailNotify: 1, notifiedAt: 1, dueAt: 1 });
// The to-do list's query: my pending tasks, soonest first.
reminderSchema.index({ assignedTo: 1, status: 1, dueAt: 1 });

reminderSchema.virtual('isOverdue').get(function isOverdue() {
  return this.status === REMINDER_STATUS.PENDING && this.dueAt < new Date();
});

/** The moment the notification email should fire. */
reminderSchema.virtual('notifyAt').get(function notifyAt() {
  return new Date(this.dueAt.getTime() - (this.notifyBeforeMinutes || 0) * 60_000);
});

module.exports = mongoose.model('Reminder', reminderSchema);
