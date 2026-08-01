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

/**
 * Deal fields a PATCH may assign. Anything outside this list is ignored, so a
 * crafted body cannot reach fields the API does not mean to expose.
 */
const UPDATABLE_DEAL_FIELDS = [
  'title',
  'stage',
  'status',
  'value',
  'currency',
  'owner',
  'expectedCloseDate',
  'probability',
  'company',
  'contactName',
  'contactDesignation',
  'contactEmail',
  'contactPhone',
  'contacts',
  'source',
  'description',
  'lostReason',
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
  UPDATABLE_DEAL_FIELDS,
};
