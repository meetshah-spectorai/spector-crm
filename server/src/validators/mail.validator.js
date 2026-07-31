'use strict';

const { z } = require('zod');
const { PROVIDER_KEYS } = require('../services/mail/providers');
const { objectId } = require('./deal.validator');

const createAccountSchema = z.object({
  provider: z.enum(PROVIDER_KEYS),
  email: z.string().trim().toLowerCase().email('Enter the mailbox address'),
  password: z.string().min(1, 'Enter the app password'),
  /** Only needed for the generic IMAP provider; presets fill these in. */
  host: z.string().trim().max(255).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  secure: z.coerce.boolean().optional(),
  /** When the login name differs from the address. */
  authUser: z.string().trim().max(255).optional(),
});

const updateAccountSchema = z.object({
  isActive: z.coerce.boolean(),
});

const listDealEmailsSchema = z.object({
  search: z.string().trim().max(200).optional(),
  filter: z.enum(['all', 'sent', 'received', 'attachments', 'unread']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

const dealParamSchema = z.object({ dealId: objectId });

const threadParamSchema = z.object({
  threadKey: z.string().trim().min(1).max(64),
});

const threadQuerySchema = z.object({
  deal: objectId.optional(),
  // Mirrors the list filters so an expanded thread shows the same subset.
  filter: z.enum(['all', 'sent', 'received', 'attachments', 'unread']).optional().default('all'),
  search: z.string().trim().max(200).optional(),
});

module.exports = {
  createAccountSchema,
  updateAccountSchema,
  listDealEmailsSchema,
  dealParamSchema,
  threadParamSchema,
  threadQuerySchema,
};
