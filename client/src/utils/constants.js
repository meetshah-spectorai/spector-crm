/**
 * Fixed enums the UI renders. Pipeline stages are NOT here — they are
 * configurable and come from the API (see features/stages/stagesSlice).
 */

/**
 * Palette tokens a column can use, mapped to Tailwind classes.
 *
 * Written out as literal class strings so Tailwind's scanner can see them;
 * building them dynamically (`bg-${color}-500`) would get them purged.
 */
export const STAGE_COLOR_STYLES = {
  slate: { dot: 'bg-slate-400', bar: 'bg-slate-300', badge: 'bg-slate-100 text-slate-700', swatch: 'bg-slate-400' },
  sky: { dot: 'bg-sky-500', bar: 'bg-sky-400', badge: 'bg-sky-100 text-sky-700', swatch: 'bg-sky-500' },
  violet: { dot: 'bg-violet-500', bar: 'bg-violet-400', badge: 'bg-violet-100 text-violet-700', swatch: 'bg-violet-500' },
  amber: { dot: 'bg-amber-500', bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800', swatch: 'bg-amber-500' },
  emerald: { dot: 'bg-emerald-500', bar: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700', swatch: 'bg-emerald-500' },
  rose: { dot: 'bg-rose-500', bar: 'bg-rose-400', badge: 'bg-rose-100 text-rose-700', swatch: 'bg-rose-500' },
  teal: { dot: 'bg-teal-500', bar: 'bg-teal-400', badge: 'bg-teal-100 text-teal-700', swatch: 'bg-teal-500' },
  indigo: { dot: 'bg-indigo-500', bar: 'bg-indigo-400', badge: 'bg-indigo-100 text-indigo-700', swatch: 'bg-indigo-500' },
  fuchsia: { dot: 'bg-fuchsia-500', bar: 'bg-fuchsia-400', badge: 'bg-fuchsia-100 text-fuchsia-700', swatch: 'bg-fuchsia-500' },
  orange: { dot: 'bg-orange-500', bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', swatch: 'bg-orange-500' },
};

export const STAGE_COLORS = Object.keys(STAGE_COLOR_STYLES);

/** Safe lookup for a colour that the server does not recognise. */
export const colorStyles = (color) => STAGE_COLOR_STYLES[color] || STAGE_COLOR_STYLES.slate;

/** What reaching a column means for the deals in it. */
export const STAGE_OUTCOMES = [
  { key: 'open', label: 'In progress', hint: 'The deal is still in play' },
  { key: 'won', label: 'Won', hint: 'Closes the deal as won, at 100%' },
  { key: 'lost', label: 'Lost', hint: 'Closes the deal as lost, at 0%' },
];

export const OUTCOME_LABELS = Object.fromEntries(STAGE_OUTCOMES.map((o) => [o.key, o.label]));

/** Task urgency. Deals do not carry a priority — only reminders do. */
export const PRIORITIES = [
  { key: 'low', label: 'Low', badge: 'bg-slate-100 text-slate-600' },
  { key: 'medium', label: 'Medium', badge: 'bg-sky-100 text-sky-700' },
  { key: 'high', label: 'High', badge: 'bg-rose-100 text-rose-700' },
];

export const PRIORITY_STYLES = Object.fromEntries(PRIORITIES.map((p) => [p.key, p.badge]));

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'JPY'];
