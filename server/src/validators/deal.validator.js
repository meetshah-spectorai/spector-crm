'use strict';

const { z } = require('zod');
const { DEAL_STATUS_LIST, CURRENCIES } = require('../utils/constants');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

/**
 * Stages are configurable, so the valid set is not knowable at schema time.
 * Shape is checked here; existence is checked by stage.service in the controller.
 */
const stageKey = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9_]+$/, 'Invalid stage');

const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  });

const createDealSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(140),
  company: z.string().trim().max(140).optional().default(''),
  contactName: z.string().trim().max(120).optional().default(''),
  contactDesignation: z.string().trim().max(120).optional().default(''),
  contactEmail: z
    .union([z.string().trim().toLowerCase().email('Invalid contact email'), z.literal('')])
    .optional()
    .default(''),
  contactPhone: z.string().trim().max(40).optional().default(''),

  /** Extra people on the deal; email sync matches against these too. */
  contacts: z
    .array(
      z.object({
        name: z.string().trim().max(120).optional().default(''),
        designation: z.string().trim().max(120).optional().default(''),
        email: z.string().trim().toLowerCase().email('Invalid contact email'),
        phone: z.string().trim().max(40).optional().default(''),
      })
    )
    .max(20)
    .optional(),

  value: z.coerce.number().min(0, 'Value cannot be negative').max(1e12).default(0),
  currency: z.enum(CURRENCIES).default('USD'),

  stage: stageKey.optional(), // defaults to the first column on the board
  probability: z.coerce.number().min(0).max(100).optional(),

  owner: objectId.optional(), // defaults to the caller
  source: z.string().trim().max(60).optional().default(''),
  description: z.string().trim().max(4000).optional().default(''),
  expectedCloseDate: optionalDate,
  lostReason: z.string().trim().max(500).optional().default(''),
});

const updateDealSchema = createDealSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field to update' }
);

const moveDealSchema = z.object({
  stage: stageKey,
  /** Target index inside the destination column (0 = top). */
  index: z.coerce.number().int().min(0).default(0),
  lostReason: z.string().trim().max(500).optional(),
});

const listDealsSchema = z.object({
  stage: stageKey.optional(),
  status: z.enum(DEAL_STATUS_LIST).optional(),
  owner: z.union([objectId, z.literal('me')]).optional(),
  search: z.string().trim().max(120).optional(),
  archived: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('false'),
  minValue: z.coerce.number().min(0).optional(),
  maxValue: z.coerce.number().min(0).optional(),
  sort: z
    .enum(['order', 'newest', 'oldest', 'value', 'closeDate', 'title'])
    .optional()
    .default('order'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

const idParamSchema = z.object({ id: objectId });

module.exports = {
  objectId,
  stageKey,
  createDealSchema,
  updateDealSchema,
  moveDealSchema,
  listDealsSchema,
  idParamSchema,
};
