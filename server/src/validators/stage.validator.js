'use strict';

const { z } = require('zod');
const { STAGE_COLORS, STAGE_OUTCOMES } = require('../utils/constants');

const createStageSchema = z.object({
  label: z.string().trim().min(1, 'Give the column a name').max(40),
  outcome: z.enum(STAGE_OUTCOMES).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  color: z.enum(STAGE_COLORS).optional(),
});

const updateStageSchema = z
  .object({
    label: z.string().trim().min(1, 'Give the column a name').max(40).optional(),
    outcome: z.enum(STAGE_OUTCOMES).optional(),
    probability: z.coerce.number().int().min(0).max(100).optional(),
    color: z.enum(STAGE_COLORS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

module.exports = { createStageSchema, updateStageSchema };
