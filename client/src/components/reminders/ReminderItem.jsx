import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Check, Clock, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { Avatar, Badge, ConfirmDialog } from '@/components/ui';
import {
  completeReminder,
  deleteReminder,
  updateReminder,
} from '@/features/reminders/remindersSlice';
import { formatDueDate, formatMoney } from '@/utils/format';
import { PRIORITY_STYLES } from '@/utils/constants';

/**
 * One row in the to-do list. `showDeal` adds the deal context that the
 * centralized list needs but a deal's own panel does not.
 */
export default function ReminderItem({ reminder, showDeal = true, onEdit, onChanged }) {
  const dispatch = useDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const done = reminder.status === 'completed';
  const cancelled = reminder.status === 'cancelled';
  const overdue = reminder.status === 'pending' && new Date(reminder.dueAt) < new Date();
  const deal = reminder.deal;

  const run = async (thunk, successMessage) => {
    setBusy(true);
    try {
      await dispatch(thunk).unwrap();
      if (successMessage) toast.success(successMessage);
      onChanged?.();
    } catch (message) {
      toast.error(message || 'Could not update the task');
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  return (
    <li
      className={clsx(
        'group relative flex items-start gap-3 rounded-xl border bg-white px-3 py-3 transition-colors',
        overdue ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200',
        (done || cancelled) && 'opacity-60'
      )}
    >
      <button
        type="button"
        disabled={busy || done || cancelled}
        onClick={() => run(completeReminder(reminder._id), 'Task completed')}
        className={clsx(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
          done
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500',
          (busy || cancelled) && 'cursor-not-allowed'
        )}
        aria-label={done ? 'Completed' : `Mark "${reminder.title}" as done`}
      >
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            'text-sm font-semibold text-slate-900',
            (done || cancelled) && 'line-through decoration-slate-400'
          )}
        >
          {reminder.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className={clsx(
              'inline-flex items-center gap-1 font-medium',
              overdue ? 'text-rose-600' : 'text-slate-500'
            )}
          >
            <Clock className="h-3 w-3" aria-hidden />
            {formatDueDate(reminder.dueAt)}
          </span>

          <Badge className={PRIORITY_STYLES[reminder.priority] || PRIORITY_STYLES.medium}>
            {reminder.priority}
          </Badge>

          {cancelled && <Badge className="bg-slate-100 text-slate-600">cancelled</Badge>}
        </div>

        {reminder.notes && (
          <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">
            {reminder.notes}
          </p>
        )}

        {showDeal && deal && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Link
              to={`/deals/${deal._id}`}
              className="truncate font-medium text-brand-600 hover:underline"
            >
              {deal.title}
            </Link>
            <span className="tabular-nums text-slate-400">
              {formatMoney(deal.value, deal.currency)}
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {reminder.assignedTo?.name && <Avatar name={reminder.assignedTo.name} size="xs" />}

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Task actions"
            aria-expanded={menuOpen}
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lift">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit?.(reminder);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                </button>

                {!done && !cancelled && (
                  <button
                    type="button"
                    onClick={() =>
                      run(
                        updateReminder({ id: reminder._id, status: 'cancelled' }),
                        'Task cancelled'
                      )
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden /> Cancel task
                  </button>
                )}

                {(done || cancelled) && (
                  <button
                    type="button"
                    onClick={() =>
                      run(updateReminder({ id: reminder._id, status: 'pending' }), 'Task reopened')
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Clock className="h-3.5 w-3.5" aria-hidden /> Reopen
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          run(deleteReminder(reminder._id), 'Task deleted');
        }}
        title="Delete this task?"
        message={`"${reminder.title}" will be removed. The activity log keeps a record of it.`}
        confirmLabel="Delete"
        loading={busy}
      />
    </li>
  );
}
