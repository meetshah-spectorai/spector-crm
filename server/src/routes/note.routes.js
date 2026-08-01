'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/note.controller');
const {
  createNoteSchema,
  updateNoteSchema,
  listNotesSchema,
} = require('../validators/note.validator');
const { idParamSchema } = require('../validators/deal.validator');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(validate(listNotesSchema, 'query'), ctrl.listNotes)
  .post(validate(createNoteSchema), ctrl.createNote);

router
  .route('/:id')
  .all(validate(idParamSchema, 'params'))
  .patch(validate(updateNoteSchema), ctrl.updateNote)
  .delete(ctrl.deleteNote);

module.exports = router;
