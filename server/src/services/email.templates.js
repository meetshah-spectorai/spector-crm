'use strict';

const config = require('../config/env');

const escape = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatMoney = (value = 0, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
};

const formatDate = (date) =>
  new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: config.DIGEST_TIMEZONE,
    timeZoneName: 'short',
  });

const dealUrl = (dealId) => `${config.appUrl}/deals/${dealId}`;
const tasksUrl = () => `${config.appUrl}/tasks`;

function layout({ heading, intro, bodyHtml, ctaLabel, ctaUrl }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:24px 28px 8px;">
          <div style="font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;">Spector.AI CRM</div>
          <h1 style="margin:8px 0 4px;font-size:20px;line-height:1.3;">${escape(heading)}</h1>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">${escape(intro)}</p>
        </td>
      </tr>
      <tr><td style="padding:16px 28px 4px;">${bodyHtml}</td></tr>
      ${
        ctaUrl
          ? `<tr><td style="padding:8px 28px 28px;">
               <a href="${ctaUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">${escape(
                 ctaLabel
               )}</a>
             </td></tr>`
          : ''
      }
      <tr>
        <td style="padding:0 28px 24px;border-top:1px solid #eef2f6;">
          <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
            You are receiving this because email reminders are enabled on your
            Spector.AI CRM account. You can turn them off in Settings.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function dealCard(deal) {
  if (!deal) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 12px;">
    <tr><td style="padding:14px 16px;">
      <div style="font-size:15px;font-weight:600;">${escape(deal.title)}</div>
      <div style="margin-top:4px;color:#475569;font-size:13px;">
        ${deal.company ? `${escape(deal.company)} &middot; ` : ''}${formatMoney(
          deal.value,
          deal.currency
        )} &middot; ${escape(deal.stage)}
      </div>
    </td></tr>
  </table>`;
}

function taskRow(reminder, { overdue = false } = {}) {
  const deal = reminder.deal || {};
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef2f6;">
      <div style="font-size:14px;font-weight:600;">${escape(reminder.title)}</div>
      <div style="margin-top:2px;font-size:13px;color:${overdue ? '#dc2626' : '#475569'};">
        ${overdue ? 'Overdue &middot; ' : ''}${escape(formatDate(reminder.dueAt))}
      </div>
      ${
        deal.title
          ? `<div style="margin-top:2px;font-size:13px;color:#64748b;">
               <a href="${dealUrl(deal._id || deal.id)}" style="color:#4f46e5;text-decoration:none;">${escape(
                 deal.title
               )}</a>${deal.value !== undefined ? ` &middot; ${formatMoney(deal.value, deal.currency)}` : ''}
             </div>`
          : ''
      }
    </td>
  </tr>`;
}

function reminderDue({ user, reminder, deal }) {
  const overdue = new Date(reminder.dueAt) < new Date();
  const subject = `${overdue ? 'Overdue' : 'Reminder'}: ${reminder.title}`;

  const bodyHtml = `
    ${dealCard(deal)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:0 0 8px;font-size:14px;"><strong>Due:</strong> ${escape(
        formatDate(reminder.dueAt)
      )}</td></tr>
      ${
        reminder.notes
          ? `<tr><td style="padding:0 0 8px;font-size:14px;color:#475569;white-space:pre-wrap;">${escape(
              reminder.notes
            )}</td></tr>`
          : ''
      }
    </table>`;

  const text = [
    `${overdue ? 'Overdue' : 'Upcoming'} next action: ${reminder.title}`,
    `Due: ${formatDate(reminder.dueAt)}`,
    deal ? `Deal: ${deal.title} (${formatMoney(deal.value, deal.currency)}) — ${dealUrl(deal._id)}` : '',
    reminder.notes ? `Notes: ${reminder.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    text,
    html: layout({
      heading: reminder.title,
      intro: `Hi ${user.name}, this next action is ${overdue ? 'overdue' : 'coming up'}.`,
      bodyHtml,
      ctaLabel: deal ? 'Open deal' : 'Open tasks',
      ctaUrl: deal ? dealUrl(deal._id) : tasksUrl(),
    }),
  };
}

function reminderAssigned({ user, reminder, deal, actor }) {
  const subject = `New next action: ${reminder.title}`;
  const bodyHtml = `
    ${dealCard(deal)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:0 0 8px;font-size:14px;"><strong>Due:</strong> ${escape(
        formatDate(reminder.dueAt)
      )}</td></tr>
      ${
        reminder.notes
          ? `<tr><td style="padding:0 0 8px;font-size:14px;color:#475569;white-space:pre-wrap;">${escape(
              reminder.notes
            )}</td></tr>`
          : ''
      }
    </table>`;

  return {
    subject,
    text: `${actor ? actor.name : 'Someone'} assigned you: ${reminder.title} (due ${formatDate(
      reminder.dueAt
    )})`,
    html: layout({
      heading: reminder.title,
      intro: `Hi ${user.name}, ${actor ? actor.name : 'someone'} assigned this next action to you.`,
      bodyHtml,
      ctaLabel: deal ? 'Open deal' : 'Open tasks',
      ctaUrl: deal ? dealUrl(deal._id) : tasksUrl(),
    }),
  };
}

function dailyDigest({ user, overdue = [], today = [], upcoming = [] }) {
  const total = overdue.length + today.length;
  const subject =
    total === 0
      ? 'Your Spector.AI CRM day: nothing due today'
      : `Your Spector.AI CRM day: ${total} task${total === 1 ? '' : 's'}${
          overdue.length ? ` (${overdue.length} overdue)` : ''
        }`;

  const section = (label, items, opts) =>
    items.length
      ? `<div style="margin:0 0 18px;">
           <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">${escape(
             label
           )} (${items.length})</div>
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
             ${items.map((r) => taskRow(r, opts)).join('')}
           </table>
         </div>`
      : '';

  const bodyHtml =
    total === 0 && upcoming.length === 0
      ? `<p style="margin:0 0 12px;font-size:14px;color:#475569;">No pending next actions. Nice and clear.</p>`
      : [
          section('Overdue', overdue, { overdue: true }),
          section('Due today', today),
          section('Next 7 days', upcoming),
        ].join('');

  const asText = (label, items) =>
    items.length ? `${label}:\n${items.map((r) => `  - ${r.title} (${formatDate(r.dueAt)})`).join('\n')}` : '';

  return {
    subject,
    text: [
      `Good morning ${user.name},`,
      asText('Overdue', overdue),
      asText('Due today', today),
      asText('Next 7 days', upcoming),
      tasksUrl(),
    ]
      .filter(Boolean)
      .join('\n\n'),
    html: layout({
      heading: 'Your day at a glance',
      intro: `Good morning ${user.name}, here is what is pending across your deals.`,
      bodyHtml,
      ctaLabel: 'Open to-do list',
      ctaUrl: tasksUrl(),
    }),
  };
}

module.exports = { reminderDue, reminderAssigned, dailyDigest, formatMoney, formatDate };
