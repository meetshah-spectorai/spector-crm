import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AlarmClock, ArrowRight, CheckSquare, Target, TrendingUp, Trophy } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import StatTile from '@/components/dashboard/StatTile';
import PipelineByStageChart from '@/components/dashboard/PipelineByStageChart';
import ReminderItem from '@/components/reminders/ReminderItem';
import { EmptyState, LoadingState } from '@/components/ui';
import { fetchStats, selectStats } from '@/features/deals/dealsSlice';
import { fetchReminders, selectReminders } from '@/features/reminders/remindersSlice';
import { selectUser } from '@/features/auth/authSlice';
import { formatMoney } from '@/utils/format';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const stats = useSelector(selectStats);
  const reminders = useSelector(selectReminders);

  useEffect(() => {
    dispatch(fetchStats());
    // All pending, soonest first — so anything overdue surfaces at the top
    // rather than being filtered out by a "next 7 days" window.
    dispatch(fetchReminders({ status: 'pending', assignedTo: 'me', sort: 'dueAt', limit: 10 }));
  }, [dispatch]);

  if (!stats) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <LoadingState label="Crunching your numbers…" />
      </>
    );
  }

  const { pipeline, thisMonth, tasks } = stats;
  const upcoming = reminders.slice(0, 6);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] || 'there'}`}
        subtitle="Here is where your pipeline stands today."
        actions={
          <Link to="/deals" className="btn-primary">
            Open deals
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={Target}
            label="Open pipeline"
            value={formatMoney(pipeline.openValue)}
            hint={`${pipeline.openDeals} open ${pipeline.openDeals === 1 ? 'deal' : 'deals'}`}
            tone="brand"
          />
          <StatTile
            icon={TrendingUp}
            label="Weighted forecast"
            value={formatMoney(pipeline.weightedValue)}
            hint="Value × win probability"
            tone="slate"
          />
          <StatTile
            icon={Trophy}
            label="Won this month"
            value={formatMoney(thisMonth.wonValue)}
            hint={`${thisMonth.won} closed · ${thisMonth.winRate}% win rate`}
            tone="emerald"
          />
          <StatTile
            icon={AlarmClock}
            label="Overdue tasks"
            value={tasks.overdue}
            hint={`${tasks.pending} pending in total`}
            tone={tasks.overdue > 0 ? 'rose' : 'slate'}
            onClick={() => navigate('/tasks')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <PipelineByStageChart byStage={stats.byStage} />
          </div>

          <section className="card flex flex-col p-4 sm:p-5 xl:col-span-2">
            <header className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Next actions</h2>
                <p className="mt-0.5 text-xs text-slate-500">Soonest first — overdue at the top</p>
              </div>
              <Link
                to="/tasks"
                className="shrink-0 text-xs font-semibold text-brand-600 hover:underline"
              >
                See all
              </Link>
            </header>

            {upcoming.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="Nothing pending"
                message="Open a deal to schedule your next follow-up."
                className="py-8"
              />
            ) : (
              <ul className="space-y-2">
                {upcoming.map((reminder) => (
                  <ReminderItem
                    key={reminder._id}
                    reminder={reminder}
                    onChanged={() => dispatch(fetchStats())}
                    onEdit={() => navigate(`/deals/${reminder.deal?._id}`)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
