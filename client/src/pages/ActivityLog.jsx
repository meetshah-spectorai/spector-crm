import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PageHeader from '@/components/layout/PageHeader';
import ActivityTimeline from '@/components/activity/ActivityTimeline';
import { Button, ErrorState, LoadingState, Select } from '@/components/ui';
import {
  fetchActivities,
  selectActivities,
  selectActivitiesError,
  selectActivitiesPaging,
  selectActivitiesStatus,
  selectActivityFilters,
  setActivityFilters,
} from '@/features/activities/activitiesSlice';
import { ACTIVITY_TYPE_OPTIONS } from '@/utils/constants';

const PAGE_SIZE = 40;

export default function ActivityLog() {
  const dispatch = useDispatch();
  const activities = useSelector(selectActivities);
  const status = useSelector(selectActivitiesStatus);
  const error = useSelector(selectActivitiesError);
  const { page, pages, total } = useSelector(selectActivitiesPaging);
  const filters = useSelector(selectActivityFilters);

  const query = (nextPage) => ({
    page: nextPage,
    limit: PAGE_SIZE,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.actor ? { actor: filters.actor } : {}),
  });

  useEffect(() => {
    dispatch(fetchActivities(query(1)));
    // Filters are the only trigger; page changes go through "Load more".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, filters]);

  return (
    <>
      <PageHeader
        title="Activity log"
        subtitle={`${total} recorded ${total === 1 ? 'event' : 'events'} — every change, note and reminder with a timestamp`}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={filters.type}
            onChange={(e) => dispatch(setActivityFilters({ type: e.target.value }))}
            className="sm:w-64"
            aria-label="Filter by event type"
          >
            <option value="">All event types</option>
            {ACTIVITY_TYPE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>

          <Select
            value={filters.actor}
            onChange={(e) => dispatch(setActivityFilters({ actor: e.target.value }))}
            className="sm:w-44"
            aria-label="Filter by person"
          >
            <option value="">Everyone</option>
            <option value="me">Only me</option>
          </Select>
        </div>
      </PageHeader>

      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          {status === 'loading' && activities.length === 0 && <LoadingState />}

          {status === 'failed' && (
            <ErrorState message={error} onRetry={() => dispatch(fetchActivities(query(1)))} />
          )}

          {activities.length > 0 && (
            <div className="card p-4 sm:p-5">
              <ActivityTimeline activities={activities} showDeal />

              {page < pages && (
                <div className="flex justify-center border-t border-slate-100 pt-4">
                  <Button
                    variant="secondary"
                    loading={status === 'loading'}
                    onClick={() => dispatch(fetchActivities(query(page + 1)))}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}

          {status === 'succeeded' && activities.length === 0 && (
            <div className="card">
              <ActivityTimeline activities={[]} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
