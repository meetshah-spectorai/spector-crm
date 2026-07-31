import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { CheckSquare, ListChecks } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import ReminderItem from '@/components/reminders/ReminderItem';
import ReminderFormModal from '@/components/reminders/ReminderFormModal';
import { EmptyState, ErrorState, LoadingState, Select } from '@/components/ui';
import {
  fetchReminders,
  selectGroupedReminders,
  selectReminderFilters,
  selectReminders,
  selectRemindersError,
  selectRemindersStatus,
  setReminderFilters,
} from '@/features/reminders/remindersSlice';
import { selectUser } from '@/features/auth/authSlice';
import { fetchUsers, selectUsers } from '@/features/users/usersSlice';

const GROUPS = [
  { key: 'overdue', label: 'Overdue', tone: 'text-rose-600' },
  { key: 'today', label: 'Today', tone: 'text-amber-600' },
  { key: 'thisWeek', label: 'This week', tone: 'text-slate-600' },
  { key: 'later', label: 'Later', tone: 'text-slate-500' },
  { key: 'done', label: 'Completed & cancelled', tone: 'text-slate-500' },
];

/**
 * The centralized to-do list: every pending next action across every deal the
 * user can see, grouped by urgency.
 */
export default function Tasks() {
  const dispatch = useDispatch();
  const filters = useSelector(selectReminderFilters);
  const groups = useSelector(selectGroupedReminders);
  const items = useSelector(selectReminders);
  const status = useSelector(selectRemindersStatus);
  const error = useSelector(selectRemindersError);
  const user = useSelector(selectUser);
  const users = useSelector(selectUsers);

  const [editing, setEditing] = useState(null);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const load = () => dispatch(fetchReminders({ ...filters, limit: 200 }));

  useEffect(() => {
    dispatch(fetchReminders({ ...filters, limit: 200 }));
  }, [dispatch, filters]);

  const visibleGroups = useMemo(
    () => GROUPS.filter((g) => groups[g.key]?.length > 0),
    [groups]
  );

  const pendingTotal =
    groups.overdue.length + groups.today.length + groups.thisWeek.length + groups.later.length;

  return (
    <>
      <PageHeader
        title="To-do list"
        subtitle={
          status === 'loading'
            ? 'Loading your next actions…'
            : `${pendingTotal} pending ${pendingTotal === 1 ? 'action' : 'actions'}${
                groups.overdue.length ? ` · ${groups.overdue.length} overdue` : ''
              }`
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={filters.status}
            onChange={(e) => dispatch(setReminderFilters({ status: e.target.value }))}
            className="sm:w-44"
            aria-label="Filter by status"
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All statuses</option>
          </Select>

          <Select
            value={filters.due}
            onChange={(e) => dispatch(setReminderFilters({ due: e.target.value }))}
            className="sm:w-44"
            aria-label="Filter by due date"
          >
            <option value="all">Any time</option>
            <option value="overdue">Overdue only</option>
            <option value="today">Due today</option>
            <option value="week">Next 7 days</option>
            <option value="upcoming">Upcoming</option>
          </Select>

          <Select
            value={filters.assignedTo}
            onChange={(e) => dispatch(setReminderFilters({ assignedTo: e.target.value }))}
            className="sm:w-48"
            aria-label="Filter by assignee"
          >
            <option value="me">Assigned to me</option>
            <option value="">Everyone</option>
            {users
              .filter((u) => u._id !== user?._id)
              .map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
          </Select>
        </div>
      </PageHeader>

      <div className="p-4 sm:p-6">
        {status === 'loading' && items.length === 0 && <LoadingState />}

        {status === 'failed' && <ErrorState message={error} onRetry={load} />}

        {status !== 'loading' && items.length === 0 && status !== 'failed' && (
          <EmptyState
            icon={CheckSquare}
            title="Nothing on your list"
            message="Open a deal and schedule the next action — it will show up here and in your inbox before it is due."
          />
        )}

        {visibleGroups.length > 0 && (
          <div className="mx-auto max-w-3xl space-y-6">
            {visibleGroups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                  <ListChecks className={clsx('h-3.5 w-3.5', group.tone)} aria-hidden />
                  <span className={group.tone}>{group.label}</span>
                  <span className="text-slate-400">({groups[group.key].length})</span>
                </h2>
                <ul className="space-y-2">
                  {groups[group.key].map((reminder) => (
                    <ReminderItem
                      key={reminder._id}
                      reminder={reminder}
                      onEdit={setEditing}
                      onChanged={load}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <ReminderFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        reminder={editing}
        onSaved={load}
      />
    </>
  );
}
