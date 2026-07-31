'use strict';

const { z } = require('zod');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    notificationPrefs: z
      .object({
        emailReminders: z.boolean().optional(),
        dailyDigest: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});

/**
 * Deleting your own account. The password is required as a re-authentication
 * step; `transferTo` is the teammate who inherits any deals and tasks.
 */
const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm'),
  transferTo: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid teammate id')
    .optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
};
