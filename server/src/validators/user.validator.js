'use strict';

const { z } = require('zod');
const { ACTIVITY_TYPES } = require('../utils/constants');
const { objectId } = require('./deal.validator');

const listActivitiesSchema = z.object({
  deal: objectId.optional(),
  actor: z.union([objectId, z.literal('me')]).optional(),
  type: z.enum(ACTIVITY_TYPES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

module.exports = { listActivitiesSchema };
