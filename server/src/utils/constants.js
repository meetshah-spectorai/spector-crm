'use strict';

/**
 * The columns created on first boot. After that, stages live in MongoDB and are
 * managed through /api/stages — this list is only the starting point.
 */
const DEFAULT_STAGES = [
  { key: 'lead', label: 'Lead', probability: 10, outcome: 'open', color: 'slate' },
  { key: 'qualified', label: 'Qualified', probability: 30, outcome: 'open', color: 'sky' },
  { key: 'proposal', label: 'Proposal Sent', probability: 55, outcome: 'open', color: 'violet' },
  { key: 'negotiation', label: 'Negotiation', probability: 75, outcome: 'open', color: 'amber' },
  { key: 'won', label: 'Won', probability: 100, outcome: 'won', color: 'emerald' },
  { key: 'lost', label: 'Lost', probability: 0, outcome: 'lost', color: 'rose' },
];

/** What a column means for the deals in it. */
const STAGE_OUTCOMES = ['open', 'won', 'lost'];

/** Palette tokens a column may use; the client maps these to Tailwind classes. */
const STAGE_COLORS = [
  'slate',
  'sky',
  'violet',
  'amber',
  'emerald',
  'rose',
  'teal',
  'indigo',
  'fuchsia',
  'orange',
];

const DEAL_STATUS = {
  OPEN: 'open',
  WON: 'won',
  LOST: 'lost',
};

const DEAL_STATUS_LIST = Object.values(DEAL_STATUS);

const PRIORITIES = ['low', 'medium', 'high'];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'JPY'];

const REMINDER_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const REMINDER_STATUS_LIST = Object.values(REMINDER_STATUS);

/** Every activity type written to the immutable activity log. */
const ACTIVITY_TYPES = [
  'deal.created',
  'deal.updated',
  'deal.stage_changed',
  'deal.value_changed',
  'deal.owner_changed',
  'deal.status_changed',
  'deal.archived',
  'deal.restored',
  'deal.deleted',
  'note.added',
  'reminder.created',
  'reminder.updated',
  'reminder.completed',
  'reminder.cancelled',
  'reminder.deleted',
  'reminder.notified',
  'email.sent',
  'email.received',
  'stage.created',
  'stage.updated',
  'user.registered',
  'user.login',
  'user.deleted',
];

/** Deal fields whose changes are worth a line in the activity log. */
const TRACKED_DEAL_FIELDS = [
  'title',
  'stage',
  'status',
  'value',
  'currency',
  'owner',
  'priority',
  'expectedCloseDate',
  'probability',
  'company',
  'contactName',
  'contactEmail',
  'contactPhone',
  'contacts',
  'source',
  'description',
  'lostReason',
  'tags',
];

module.exports = {
  DEFAULT_STAGES,
  STAGE_OUTCOMES,
  STAGE_COLORS,
  DEAL_STATUS,
  DEAL_STATUS_LIST,
  PRIORITIES,
  CURRENCIES,
  REMINDER_STATUS,
  REMINDER_STATUS_LIST,
  ACTIVITY_TYPES,
  TRACKED_DEAL_FIELDS,
};
