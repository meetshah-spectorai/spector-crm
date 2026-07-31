'use strict';

const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/users
 *
 * The team roster, used to populate the deal-owner and task-assignee pickers.
 * Everyone is a peer, so there is nothing to manage here — no roles to change
 * and no accounts to promote.
 */
const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({})
    .select('name email lastLoginAt createdAt')
    .sort({ name: 1 })
    .lean();

  res.json({ success: true, data: users });
});

module.exports = { listUsers };
