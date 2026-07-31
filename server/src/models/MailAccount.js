'use strict';

const mongoose = require('mongoose');
const { PROVIDER_KEYS } = require('../services/mail/providers');

/**
 * A mailbox the CRM reads from. One per connected address.
 *
 * `authPassEnc` holds the app password encrypted with AES-256-GCM (see
 * utils/crypto). It is `select: false`, so it is never loaded unless the sync
 * engine explicitly asks for it, and it never appears in an API response.
 */
const mailAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: PROVIDER_KEYS,
      required: true,
    },
    /** The mailbox address. Also used to decide sent vs received. */
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    host: { type: String, trim: true, default: '' },
    port: { type: Number, default: 993 },
    secure: { type: Boolean, default: true },
    authUser: { type: String, trim: true, default: '' }, // defaults to `email`
    authPassEnc: { type: String, required: true, select: false },

    isActive: { type: Boolean, default: true },

    /** Per-folder IMAP cursor: { 'INBOX': { uidNext, uidValidity } }. */
    cursors: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    lastSyncAt: Date,
    lastSyncStatus: {
      type: String,
      enum: ['never', 'ok', 'error', 'running'],
      default: 'never',
    },
    lastSyncError: { type: String, default: '' },
    lastSyncCount: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
  },
  { timestamps: true }
);

mailAccountSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.authPassEnc;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('MailAccount', mailAccountSchema);
