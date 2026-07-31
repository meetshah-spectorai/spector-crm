'use strict';

const path = require('path');
const { z } = require('zod');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bool = (defaultValue) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? defaultValue : v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CLIENT_ORIGINS: z.string().default('http://localhost:5173'),
  APP_URL: z.string().default('http://localhost:5173'),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('CRM <no-reply@example.com>'),

  ENABLE_SCHEDULER: bool(true),
  REMINDER_LEAD_MINUTES: z.coerce.number().int().min(0).default(30),
  ENABLE_DAILY_DIGEST: bool(true),
  DAILY_DIGEST_CRON: z.string().default('0 8 * * *'),
  DIGEST_TIMEZONE: z.string().default('UTC'),

  // --- Mailbox sync (Emails tab) --------------------------------------------
  // 64 hex chars (32 bytes). Required only if you connect a mailbox — mailbox
  // credentials are encrypted at rest with it.
  MAIL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'MAIL_ENCRYPTION_KEY must be 64 hex characters')
    .optional()
    .or(z.literal('')),
  ENABLE_MAIL_SYNC: bool(true),
  MAIL_SYNC_CRON: z.string().default('*/5 * * * *'),
  /** How far back to reach on a mailbox's first sync. */
  MAIL_BACKFILL_DAYS: z.coerce.number().int().min(1).max(3650).default(180),
  /** Safety cap on messages examined per folder per run. */
  MAIL_MAX_PER_RUN: z.coerce.number().int().min(10).max(5000).default(400),

  SEED_NAME: z.string().default('You'),
  SEED_EMAIL: z.string().email().default('you@example.com'),
  SEED_PASSWORD: z.string().default('Passw0rd!'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // Fail fast: a half-configured server is worse than one that refuses to boot.
  console.error(`\nInvalid environment configuration:\n${details}\n`);
  console.error('Copy server/.env.example to server/.env and fill in the values.\n');
  process.exit(1);
}

const env = parsed.data;

const config = Object.freeze({
  ...env,
  isProd: env.NODE_ENV === 'production',
  isDev: env.NODE_ENV === 'development',
  clientOrigins: env.CLIENT_ORIGINS.split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  appUrl: env.APP_URL.replace(/\/$/, ''),
  mailEnabled: Boolean(env.SMTP_HOST),
  mailboxSyncReady: Boolean(env.MAIL_ENCRYPTION_KEY),
});

module.exports = config;
