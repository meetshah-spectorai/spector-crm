'use strict';

const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');
const templates = require('./email.templates');

let transporter = null;

/**
 * Real SMTP when SMTP_HOST is configured, otherwise a console transport so
 * local development never needs mail credentials.
 */
function getTransporter() {
  if (transporter) return transporter;

  if (!config.mailEnabled) {
    transporter = {
      // Reported as NOT-SENT: this used to log the same "Email sent" line as the
      // real transport, which made a console-mode run look like a delivery.
      sendMail: async (message) => {
        logger.warn(
          `[mail:NOT SENT — no SMTP configured] to=${message.to} subject="${message.subject}"\n${message.text || ''}`
        );
        return { messageId: 'console-transport', consoleOnly: true };
      },
    };
    logger.warn('SMTP_HOST is not set — emails are logged here and NOT delivered.');
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE, // true for 465, false for 587/STARTTLS
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });

  return transporter;
}

async function verifyTransport() {
  if (!config.mailEnabled) return false;
  try {
    await getTransporter().verify();
    logger.info(`SMTP ready (${config.SMTP_HOST}:${config.SMTP_PORT})`);
    return true;
  } catch (err) {
    logger.error('SMTP verification failed:', err.message);
    return false;
  }
}

/** Never let a mail failure bubble into a request or crash the scheduler. */
async function sendMail({ to, subject, html, text }) {
  if (!to) return false;
  try {
    const info = await getTransporter().sendMail({
      from: config.MAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    if (info?.consoleOnly) return true; // already logged as not-sent
    // `accepted`/`rejected` come from the SMTP conversation: the server can accept
    // the message and still bounce it later, so this is handover, not delivery.
    if (info?.rejected?.length) {
      logger.error(`Email to ${to} was REJECTED by the mail server: ${info.response || ''}`);
      return false;
    }
    logger.info(
      `Email accepted by ${config.SMTP_HOST} for ${to}: ${subject}` +
        (info?.messageId ? ` (id ${info.messageId})` : '')
    );
    return true;
  } catch (err) {
    logger.error(`Email to ${to} failed:`, err.message);
    return false;
  }
}

/** Reminder is due (or due soon). */
function sendReminderDueEmail({ user, reminder, deal }) {
  const { subject, html, text } = templates.reminderDue({ user, reminder, deal });
  return sendMail({ to: user.email, subject, html, text });
}

/** Morning roundup of overdue + today's tasks. */
function sendDailyDigestEmail({ user, overdue, today, upcoming }) {
  const { subject, html, text } = templates.dailyDigest({ user, overdue, today, upcoming });
  return sendMail({ to: user.email, subject, html, text });
}

/** Someone else assigned you a next action. */
function sendReminderAssignedEmail({ user, reminder, deal, actor }) {
  const { subject, html, text } = templates.reminderAssigned({ user, reminder, deal, actor });
  return sendMail({ to: user.email, subject, html, text });
}

module.exports = {
  getTransporter,
  verifyTransport,
  sendMail,
  sendReminderDueEmail,
  sendDailyDigestEmail,
  sendReminderAssignedEmail,
};
