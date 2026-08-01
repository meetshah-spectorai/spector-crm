'use strict';

const mongoose = require('mongoose');
const Note = require('../models/Note');
const Deal = require('../models/Deal');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const AUTHOR_FIELDS = 'name email';
const DEAL_FIELDS = 'title company';

/** Escapes regex metacharacters so "C++ (v2)" is a search, not a syntax error. */
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/notes?deal=<id>
 * The note log for a deal (or, without `deal`, everything the team has written).
 * Pinned notes come first, then newest.
 */
const listNotes = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const filter = {};
  if (req.query.deal) filter.deal = new mongoose.Types.ObjectId(req.query.deal);
  if (req.query.search) filter.body = new RegExp(escapeRegex(req.query.search), 'i');

  const [rows, total] = await Promise.all([
    Note.find(filter)
      .sort({ pinned: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS)
      .populate({ path: 'deal', select: DEAL_FIELDS })
      .lean(),
    Note.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: rows,
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/** POST /api/notes */
const createNote = asyncHandler(async (req, res) => {
  const { deal: dealId, ...rest } = req.body;

  const deal = await Deal.findById(dealId).select('_id');
  if (!deal) throw ApiError.badRequest('The deal does not exist');

  const note = await Note.create({ ...rest, deal: deal._id, author: req.user._id });

  await note.populate('author', AUTHOR_FIELDS);
  res.status(201).json({ success: true, data: note.toJSON() });
});

/**
 * PATCH /api/notes/:id
 * The pipeline is shared, but a note is a record of what one person observed —
 * so only its author may rewrite it.
 */
const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) throw ApiError.notFound('Note not found');
  if (String(note.author) !== String(req.user._id)) {
    throw ApiError.forbidden('Only the author can edit this note');
  }

  if (req.body.body !== undefined && req.body.body !== note.body) {
    note.body = req.body.body;
    note.editedAt = new Date();
  }
  if (req.body.pinned !== undefined) note.pinned = req.body.pinned;

  await note.save();

  await note.populate('author', AUTHOR_FIELDS);
  res.json({ success: true, data: note.toJSON() });
});

/** DELETE /api/notes/:id */
const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) throw ApiError.notFound('Note not found');
  if (String(note.author) !== String(req.user._id)) {
    throw ApiError.forbidden('Only the author can delete this note');
  }

  await note.deleteOne();

  res.json({ success: true, message: 'Note deleted' });
});

module.exports = { listNotes, createNote, updateNote, deleteNote };
