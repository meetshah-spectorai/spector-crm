'use strict';

const { z } = require('zod');
const { REMINDER_STATUS_LIST, PRIORITIES } = require('../utils/constants');
const { objectId } = require('./deal.validator');

const requiredDate = z.union([z.string(), z.date()]).transform((v, ctx) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date' });
    return z.NEVER;
  }
  return d;
});

const createReminderSchema = z.object({
  deal: objectId,
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(160),
  notes: z.string().trim().max(2000).optional().default(''),
  dueAt: requiredDate,
  assignedTo: objectId.optional(), // defaults to the deal owner
  priority: z.enum(PRIORITIES).optional().default('medium'),
  notifyBeforeMinutes: z.coerce.number().int().min(0).max(20160).optional().default(30),
  emailNotify: z.coerce.boolean().optional().default(true),
});

const updateReminderSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    notes: z.string().trim().max(2000).optional(),
    dueAt: requiredDate.optional(),
    assignedTo: objectId.optional(),
    priority: z.enum(PRIORITIES).optional(),
    status: z.enum(REMINDER_STATUS_LIST).optional(),
    notifyBeforeMinutes: z.coerce.number().int().min(0).max(20160).optional(),
    emailNotify: z.coerce.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

const listRemindersSchema = z.object({
  status: z.enum([...REMINDER_STATUS_LIST, 'all']).optional().default('pending'),
  deal: objectId.optional(),
  assignedTo: z.union([objectId, z.literal('me')]).optional(),
  /** Convenience buckets for the to-do list UI. */
  due: z.enum(['overdue', 'today', 'week', 'upcoming', 'all']).optional().default('all'),
  sort: z.enum(['dueAt', 'dueAtDesc', 'created', 'priority']).optional().default('dueAt'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

module.exports = { createReminderSchema, updateReminderSchema, listRemindersSchema };
