'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/auth.controller');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
} = require('../validators/auth.validator');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);

router.get('/me', protect, ctrl.me);
router.patch('/me', protect, validate(updateProfileSchema), ctrl.updateProfile);
// Destructive and irreversible, so it is rate limited like the credential routes.
router.delete('/me', protect, authLimiter, validate(deleteAccountSchema), ctrl.deleteMyAccount);
router.post(
  '/change-password',
  protect,
  authLimiter,
  validate(changePasswordSchema),
  ctrl.changePassword
);

module.exports = router;
