import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import DealCard from './DealCard';
import { formatMoneyCompact } from '@/utils/format';
import { colorStyles } from '@/utils/constants';

export default function StageColumn({ column, onOpenDeal, onAddDeal, activeStage }) {
  // Droppable on the column itself, so an empty column still accepts a card.
  const { setNodeRef, isOver } = useDroppable({
    id: `stage:${column.key}`,
    data: { type: 'stage', stage: column.key },
  });

  const style = colorStyles(column.color);
  const isTarget = isOver || activeStage === column.key;
  const currency = column.deals[0]?.currency || 'USD';

  return (
    <section
      className={clsx(
        'flex w-[280px] shrink-0 flex-col rounded-xl border transition-colors sm:w-[300px]',
        isTarget ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200 bg-slate-100/60'
      )}
      aria-label={`${column.label} — ${column.count} deals`}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className={clsx('h-2 w-2 shrink-0 rounded-full', style.dot)} aria-hidden />
        <h2 className="text-sm font-semibold text-slate-800">{column.label}</h2>
        <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
          {column.count}
        </span>
        <span className="ml-auto text-xs font-semibold tabular-nums text-slate-600">
          {formatMoneyCompact(column.totalValue, currency)}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 scrollbar-thin"
      >
        <SortableContext
          items={column.deals.map((d) => d._id)}
          strategy={verticalListSortingStrategy}
        >
          {column.deals.map((deal) => (
            <DealCard key={deal._id} deal={deal} color={column.color} onOpen={onOpenDeal} />
          ))}
        </SortableContext>

        {column.deals.length === 0 && (
          <p
            className={clsx(
              'mt-2 rounded-lg border border-dashed px-3 py-6 text-center text-xs',
              isTarget ? 'border-brand-300 text-brand-600' : 'border-slate-300 text-slate-400'
            )}
          >
            {isTarget ? 'Drop here' : 'No deals'}
          </p>
        )}
      </div>

      <footer className="px-2 pb-2">
        <button
          type="button"
          onClick={() => onAddDeal?.(column.key)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-brand-400 hover:bg-white hover:text-brand-600"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add deal
        </button>
      </footer>
    </section>
  );
}
