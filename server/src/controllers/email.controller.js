'use strict';

const mongoose = require('mongoose');
const EmailMessage = require('../models/EmailMessage');
const Deal = require('../models/Deal');
const MailAccount = require('../models/MailAccount');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { dealContactEmails, dealContactName } = require('../services/mail/contactIndex');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Filter clause for the tab's segmented control. */
function filterClause(filter) {
  switch (filter) {
    case 'sent':
      return { direction: 'sent' };
    case 'received':
      return { direction: 'received' };
    case 'attachments':
      return { hasAttachments: true };
    case 'unread':
      return { isUnread: true };
    default:
      return {};
  }
}

/** Search across subject, body, sender and recipients. */
function searchClause(search) {
  if (!search) return {};
  const rx = new RegExp(escapeRegex(search), 'i');
  return {
    $or: [
      { subject: rx },
      { bodyText: rx },
      { preview: rx },
      { 'from.email': rx },
      { 'from.name': rx },
      { 'to.email': rx },
      { 'to.name': rx },
      { participants: rx },
    ],
  };
}

/**
 * GET /api/emails/deal/:dealId
 *
 * Returns conversation summaries for a deal, newest activity first, paginated for
 * infinite scroll. Threads are keyed by (conversation, matched contact) so the
 * client can group them under each contact without a second request.
 *
 * Query: search, filter=all|sent|received|attachments|unread, page, limit
 */
const listDealEmails = asyncHandler(async (req, res) => {
  const { search, filter = 'all', page = 1, limit = 10 } = req.query;

  const deal = await Deal.findById(req.params.dealId)
    .select('_id title contactEmail contactName contacts')
    .lean();
  if (!deal) throw ApiError.notFound('Deal not found');

  const dealId = new mongoose.Types.ObjectId(deal._id);
  const contacts = dealContactEmails(deal);

  // No contact address on the deal means there is nothing to match emails against.
  if (!contacts.length) {
    return res.json({
      success: true,
      data: { threads: [] },
      meta: {
        page: 1,
        pages: 1,
        total: 0,
        contacts: [],
        mailboxes: await mailboxSummary(),
        reason: 'no-contact-email',
      },
    });
  }

  const match = {
    'dealLinks.deal': dealId,
    ...filterClause(filter),
    ...searchClause(search),
  };

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline = [
    { $match: match },
    // One row per (thread, contact) for this deal.
    { $unwind: '$dealLinks' },
    { $match: { 'dealLinks.deal': dealId } },
    { $sort: { sentAt: -1 } },
    {
      $group: {
        _id: { threadKey: '$threadKey', contactEmail: '$dealLinks.contactEmail' },
        subject: { $first: '$subject' },
        preview: { $first: '$preview' },
        lastAt: { $first: '$sentAt' },
        lastDirection: { $first: '$direction' },
        lastFrom: { $first: '$from' },
        lastTo: { $first: '$to' },
        messageCount: { $sum: 1 },
        unreadCount: { $sum: { $cond: ['$isUnread', 1, 0] } },
        hasAttachments: { $max: { $cond: ['$hasAttachments', 1, 0] } },
        attachmentCount: { $sum: { $size: { $ifNull: ['$attachments', []] } } },
        latestId: { $first: '$_id' },
      },
    },
    { $sort: { lastAt: -1 } },
    {
      $facet: {
        rows: [{ $skip: skip }, { $limit: Number(limit) }],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await EmailMessage.aggregate(pipeline);
  const rows = result?.rows || [];
  const total = result?.total?.[0]?.count || 0;

  const threads = rows.map((r) => ({
    threadKey: r._id.threadKey,
    contactEmail: r._id.contactEmail,
    contactName: dealContactName(deal, r._id.contactEmail),
    subject: r.subject,
    preview: r.preview,
    lastAt: r.lastAt,
    lastDirection: r.lastDirection,
    lastFrom: r.lastFrom,
    lastTo: r.lastTo,
    messageCount: r.messageCount,
    unreadCount: r.unreadCount,
    hasAttachments: Boolean(r.hasAttachments),
    attachmentCount: r.attachmentCount,
    latestMessageId: r.latestId,
  }));

  res.json({
    success: true,
    data: { threads },
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
      contacts: contacts.map((email) => ({ email, name: dealContactName(deal, email) })),
      mailboxes: await mailboxSummary(),
    },
  });
});

/**
 * GET /api/emails/thread/:threadKey?deal=<id>&filter=&search=
 * The messages in one conversation, oldest first — the expanded view.
 *
 * The list's filter and search are applied here too. Without that, filtering to
 * "Sent" would show a sent-only thread summary that expanded to reveal received
 * mail as well, which reads as the filter being broken.
 */
const getThread = asyncHandler(async (req, res) => {
  const { threadKey } = req.params;
  const { filter = 'all', search } = req.query;

  const query = {
    threadKey,
    ...filterClause(filter),
    ...searchClause(search),
  };
  if (req.query.deal) {
    query['dealLinks.deal'] = new mongoose.Types.ObjectId(req.query.deal);
  }

  const messages = await EmailMessage.find(query)
    .sort({ sentAt: 1 })
    .select('-references -inReplyTo')
    .lean();

  // How many are in the conversation overall, so the UI can say what is hidden.
  const totalInThread = await EmailMessage.countDocuments({
    threadKey,
    ...(req.query.deal
      ? { 'dealLinks.deal': new mongoose.Types.ObjectId(req.query.deal) }
      : {}),
  });

  res.json({
    success: true,
    data: messages,
    meta: { totalInThread, shown: messages.length, filtered: totalInThread !== messages.length },
  });
});

/** GET /api/emails/:id — one message with its full body. */
const getMessage = asyncHandler(async (req, res) => {
  const message = await EmailMessage.findById(req.params.id).lean();
  if (!message) throw ApiError.notFound('Email not found');
  res.json({ success: true, data: message });
});

/** Connected-mailbox context, so the tab can explain an empty state. */
async function mailboxSummary() {
  const accounts = await MailAccount.find({})
    .select('email provider isActive lastSyncAt lastSyncStatus')
    .lean();
  return {
    count: accounts.length,
    active: accounts.filter((a) => a.isActive).length,
    lastSyncAt: accounts.reduce(
      (latest, a) => (a.lastSyncAt && (!latest || a.lastSyncAt > latest) ? a.lastSyncAt : latest),
      null
    ),
    anyError: accounts.some((a) => a.lastSyncStatus === 'error'),
  };
}

module.exports = { listDealEmails, getThread, getMessage };
