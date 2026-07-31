import {
  format,
  formatDistanceToNowStrict,
  isPast,
  isToday,
  isTomorrow,
  isThisYear,
} from 'date-fns';

export const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  AED: 'AED ',
  JPY: '¥',
};

/** Full currency formatting: $48,000 */
export const formatMoney = (value = 0, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `${CURRENCY_SYMBOLS[currency] || ''}${(value || 0).toLocaleString('en-US')}`;
  }
};

/** Compact form for tight spaces: $48.0k, $1.2M */
export const formatMoneyCompact = (value = 0, currency = 'USD') => {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const abs = Math.abs(value || 0);
  if (abs >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${symbol}${(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${symbol}${(value || 0).toLocaleString('en-US')}`;
};

export const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return format(d, isThisYear(d) ? 'd MMM' : 'd MMM yyyy');
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return format(new Date(date), 'd MMM yyyy, HH:mm');
};

/** "Overdue by 3 hours", "Today 14:30", "Tomorrow 09:00", "12 Aug, 09:00" */
export const formatDueDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (isPast(d)) return `Overdue by ${formatDistanceToNowStrict(d)}`;
  if (isToday(d)) return `Today ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `Tomorrow ${format(d, 'HH:mm')}`;
  return format(d, isThisYear(d) ? "d MMM, HH:mm" : 'd MMM yyyy, HH:mm');
};

export const timeAgo = (date) => (date ? `${formatDistanceToNowStrict(new Date(date))} ago` : '');

/** Email timestamps read as "31 Jul 2026 • 10:30 AM". */
export const formatEmailDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return `${format(d, 'd MMM yyyy')} • ${format(d, 'h:mm a')}`;
};

export const formatFileSize = (bytes = 0) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** ISO string → the value a datetime-local input expects. */
export const toDateTimeLocal = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};

/** A sensible default for a new reminder: tomorrow at 09:00 local time. */
export const defaultReminderDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toDateTimeLocal(d);
};

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
