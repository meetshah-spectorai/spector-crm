'use strict';

const { z } = require('zod');
const { objectId } = require('./deal.validator');

const createNoteSchema = z.object({
  deal: objectId,
  body: z.string().trim().min(1, 'Write something before saving').max(5000),
  pinned: z.coerce.boolean().optional().default(false),
});

const updateNoteSchema = z
  .object({
    body: z.string().trim().min(1, 'Write something before saving').max(5000).optional(),
    pinned: z.coerce.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

const listNotesSchema = z.object({
  deal: objectId.optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

module.exports = { createNoteSchema, updateNoteSchema, listNotesSchema };
