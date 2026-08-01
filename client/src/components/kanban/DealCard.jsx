import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { Bell, Building2, CalendarDays, GripVertical } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { formatDueDate, formatMoney, formatDate } from '@/utils/format';
import { colorStyles } from '@/utils/constants';

/**
 * Presentational card. Shared by the sortable card and the drag overlay.
 * `color` comes from the deal's column, since stages are configurable.
 */
export const DealCardBody = memo(function DealCardBody({
  deal,
  color,
  dragging,
  listeners,
  attributes,
}) {
  const overdue = deal.nextAction && new Date(deal.nextAction.dueAt) < new Date();
  const stageStyle = colorStyles(color);

  return (
    <article
      className={clsx(
        'group relative overflow-hidden rounded-xl border bg-white shadow-card transition-shadow',
        dragging ? 'border-brand-300 shadow-lift' : 'border-slate-200 hover:shadow-lift'
      )}
    >
      <span className={clsx('absolute inset-y-0 left-0 w-1', stageStyle.bar)} aria-hidden />

      <div className="pl-3.5 pr-2 py-3">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-900">{deal.title}</h3>
            {deal.company && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                {deal.company}
              </p>
            )}
          </div>

          {/* Explicit drag handle: keeps the card body clickable for navigation. */}
          <button
            type="button"
            {...listeners}
            {...attributes}
            className="shrink-0 cursor-grab rounded p-1 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-500 focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing touch-none"
            aria-label={`Drag ${deal.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-sm font-bold tabular-nums text-slate-900">
            {formatMoney(deal.value, deal.currency)}
          </span>
          {deal.contactName && (
            <span className="min-w-0 truncate text-[11px] text-slate-500">
              {deal.contactName}
              {deal.contactDesignation && ` · ${deal.contactDesignation}`}
            </span>
          )}
        </div>

        {deal.nextAction && (
          <div
            className={clsx(
              'mt-2.5 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[11px] leading-snug',
              overdue ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'
            )}
          >
            <Bell className="mt-px h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{deal.nextAction.title}</span>
              <span className="block">{formatDueDate(deal.nextAction.dueAt)}</span>
            </span>
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Avatar name={deal.owner?.name || '?'} size="xs" />
            <span className="truncate">{deal.owner?.name?.split(' ')[0]}</span>
          </span>
          {deal.expectedCloseDate && (
            <span className="flex shrink-0 items-center gap-1">
              <CalendarDays className="h-3 w-3" aria-hidden />
              {formatDate(deal.expectedCloseDate)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
});

export default function DealCard({ deal, color, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal._id,
    data: { type: 'deal', deal, stage: deal.stage },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    // The original slot stays visible but faded while the overlay follows the cursor.
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(deal)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(deal);
        }
      }}
      className="cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <DealCardBody
        deal={deal}
        color={color}
        dragging={isDragging}
        listeners={listeners}
        attributes={attributes}
      />
    </div>
  );
}
