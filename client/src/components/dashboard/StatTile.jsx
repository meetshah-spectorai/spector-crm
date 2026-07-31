import clsx from 'clsx';

/**
 * Headline number. No plot, so no hover layer — the number IS the content.
 * `tone` colours the icon chip only; the value stays in ink.
 */
export default function StatTile({ icon: Icon, label, value, hint, tone = 'brand', to, onClick }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'card flex items-start gap-3 p-4 text-left',
        onClick && 'transition-shadow hover:shadow-lift'
      )}
    >
      {Icon && (
        <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tones[tone])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-xl font-bold tabular-nums text-slate-900">
          {value}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
    </Wrapper>
  );
}
