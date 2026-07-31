'use strict';

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true, trim: true },
  },
  { _id: false }
);

/**
 * One synced email. Metadata plus body text — attachment *contents* are never
 * downloaded, only their name, type and size, which keeps the collection small
 * and avoids copying files out of the mailbox.
 *
 * Only messages that match a CRM contact are stored, so connecting a mailbox
 * does not pull someone's whole personal inbox into the database.
 */
const emailMessageSchema = new mongoose.Schema(
  {
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MailAccount',
      required: true,
      index: true,
    },

    /** RFC Message-ID. Unique per account, so a re-sync cannot duplicate. */
    messageId: { type: String, required: true, index: true },
    inReplyTo: { type: String, default: '' },
    references: { type: [String], default: [] },

    /** Stable conversation id — see services/mail/threading.js. */
    threadKey: { type: String, required: true, index: true },

    direction: {
      type: String,
      enum: ['sent', 'received'],
      required: true,
      index: true,
    },

    from: { type: addressSchema, default: () => ({}) },
    to: { type: [addressSchema], default: [] },
    cc: { type: [addressSchema], default: [] },

    subject: { type: String, default: '', trim: true },
    /** First couple of lines, for the collapsed card. */
    preview: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    bodyHtml: { type: String, default: '' },

    attachments: {
      type: [
        new mongoose.Schema(
          {
            filename: String,
            contentType: String,
            size: Number,
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    hasAttachments: { type: Boolean, default: false, index: true },

    /** Unread in the owner's own mailbox (IMAP \Seen). Not recipient tracking. */
    isUnread: { type: Boolean, default: false, index: true },

    sentAt: { type: Date, required: true, index: true },

    /** Every address on the message, lowercased — used for contact matching. */
    participants: { type: [String], default: [], index: true },

    /**
     * Which CRM records this message belongs to. `contactEmail` records *which*
     * of the deal's contacts it matched, so the UI can group by contact without
     * recomputing.
     */
    dealLinks: {
      type: [
        new mongoose.Schema(
          {
            deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
            contactEmail: String,
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    /** IMAP bookkeeping. */
    folder: { type: String, default: '' },
    uid: { type: Number },
  },
  { timestamps: true }
);

// A message is identified by (account, messageId) — the upsert key.
emailMessageSchema.index({ account: 1, messageId: 1 }, { unique: true });
// The Emails tab's main query: this deal's messages, newest first.
emailMessageSchema.index({ 'dealLinks.deal': 1, sentAt: -1 });
emailMessageSchema.index({ threadKey: 1, sentAt: 1 });
// Search across subject / body / participants.
emailMessageSchema.index({ subject: 'text', bodyText: 'text' });

module.exports = mongoose.model('EmailMessage', emailMessageSchema);
