import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Bell,
  BellOff,
  BellPlus,
  CheckCircle2,
  Circle,
  Columns3,
  DollarSign,
  Flag,
  History,
  Inbox,
  LogIn,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  UserRound,
} from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { ACTIVITY_STYLES } from '@/utils/constants';
import { formatDateTime, timeAgo } from '@/utils/format';
import { EmptyState } from '@/components/ui';

/**
 * Explicit icon map rather than `import * as Icons` — a namespace import pulls
 * the entire lucide-react set into the bundle.
 */
const ICONS = {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Bell,
  BellOff,
  BellPlus,
  CheckCircle2,
  Circle,
  Columns3,
  DollarSign,
  Flag,
  Inbox,
  LogIn,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  UserRound,
};

const FALLBACK = { icon: 'Circle', tone: 'text-slate-500 bg-slate-100' };

const readable = (field = '') =>
  field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return value.name || value._id || '—';
  // ISO timestamps look like noise in a diff; render them as dates.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
};

function ActivityRow({ activity, showDeal, isLast }) {
  const style = ACTIVITY_STYLES[activity.type] || FALLBACK;
  const Icon = ICONS[style.icon] || Circle;

  // Field-level diffs are the audit detail; a note's body is already the message.
  const diffs = (activity.changes || []).filter(
    (c) => c.field !== 'stage' && activity.type !== 'note.added'
  );

  return (
    <li className="relative flex gap-3 pb-5">
      {!isLast && (
        <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-slate-200" aria-hidden />
      )}

      <span
        className={clsx(
          'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full',
          style.tone
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm text-slate-800">
          <span className="font-semibold">{activity.actorName || 'System'}</span>{' '}
          {activity.type === 'note.added' ? 'added a note' : ''}
        </p>

        {activity.type === 'note.added' ? (
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {activity.message}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-slate-600">{activity.message}</p>
        )}

        {diffs.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {diffs.map((c, i) => (
              <li key={`${c.field}-${i}`} className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">{readable(c.field)}:</span>{' '}
                <span className="line-through decoration-slate-300">{displayValue(c.from)}</span>{' '}
                <span aria-hidden>→</span> <span className="text-slate-700">{displayValue(c.to)}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
          <time dateTime={activity.createdAt} title={formatDateTime(activity.createdAt)}>
            {timeAgo(activity.createdAt)}
          </time>
          {showDeal && activity.deal && (
            <>
              <span aria-hidden>·</span>
              <Link
                to={`/deals/${activity.deal._id || activity.deal}`}
                className="font-medium text-brand-600 hover:underline"
              >
                {activity.deal.title || 'View deal'}
              </Link>
            </>
          )}
        </p>
      </div>
    </li>
  );
}

export default function ActivityTimeline({ activities = [], showDeal = false, emptyMessage }) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nothing logged yet"
        message={emptyMessage || 'Every change, note and reminder will appear here with a timestamp.'}
      />
    );
  }

  return (
    <ol className="pt-1">
      {activities.map((activity, i) => (
        <ActivityRow
          key={activity._id}
          activity={activity}
          showDeal={showDeal}
          isLast={i === activities.length - 1}
        />
      ))}
    </ol>
  );
}
