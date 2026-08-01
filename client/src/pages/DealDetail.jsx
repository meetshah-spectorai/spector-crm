import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Mail,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import EmailsTab from '@/components/emails/EmailsTab';
import ReminderItem from '@/components/reminders/ReminderItem';
import DealFormModal from '@/components/deals/DealFormModal';
import ReminderFormModal from '@/components/reminders/ReminderFormModal';
import {
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
} from '@/components/ui';
import {
  archiveDeal,
  clearCurrentDeal,
  deleteDeal,
  fetchDeal,
  restoreDeal,
  selectCurrentDeal,
  selectCurrentStatus,
  updateDeal,
} from '@/features/deals/dealsSlice';
import { fetchStages, selectStages } from '@/features/stages/stagesSlice';
import { colorStyles } from '@/utils/constants';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';

function DetailRow({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{children}</p>
      </div>
    </div>
  );
}

export default function DealDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const current = useSelector(selectCurrentDeal);
  const status = useSelector(selectCurrentStatus);
  const stages = useSelector(selectStages);

  const [editOpen, setEditOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    dispatch(fetchDeal(id));
    dispatch(fetchStages()); // the stage picker needs the configured columns
    return () => dispatch(clearCurrentDeal());
  }, [dispatch, id]);

  const refresh = () => dispatch(fetchDeal(id));

  if (status === 'loading' || (status === 'idle' && !current)) {
    return <LoadingState label="Loading deal…" />;
  }

  if (status === 'failed' || !current) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          message="We could not load this deal. It may have been deleted, or you may not have access."
          onRetry={refresh}
        />
        <button type="button" onClick={() => navigate('/deals')} className="btn-secondary mt-3">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to deals
        </button>
      </div>
    );
  }

  const { deal, reminders } = current;
  const currentStage = stages.find((s) => s.key === deal.stage);
  const stageStyle = colorStyles(currentStage?.color);
  const pending = reminders.filter((r) => r.status === 'pending');
  const past = reminders.filter((r) => r.status !== 'pending');

  const handleStageChange = async (stage) => {
    try {
      await dispatch(updateDeal({ id: deal._id, stage })).unwrap();
      refresh();
      toast.success(`Moved to ${stages.find((s) => s.key === stage)?.label || stage}`);
    } catch (message) {
      toast.error(message || 'Could not change the stage');
    }
  };

  const handleArchiveToggle = async () => {
    const action = deal.archived ? restoreDeal : archiveDeal;
    try {
      await dispatch(action(deal._id)).unwrap();
      refresh();
      toast.success(deal.archived ? 'Deal restored' : 'Deal archived');
    } catch (message) {
      toast.error(message || 'Could not update the deal');
    }
  };

  const handleDelete = async () => {
    try {
      await dispatch(deleteDeal(deal._id)).unwrap();
      toast.success('Deal deleted');
      navigate('/deals');
    } catch (message) {
      toast.error(message || 'Could not delete the deal');
    }
  };

  return (
    <>
      <PageHeader
        title={deal.title}
        subtitle={deal.company || undefined}
        actions={
          <>
            <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </Button>
            <Button
              onClick={() => {
                setEditingReminder(null);
                setReminderOpen(true);
              }}
            >
              <Bell className="h-4 w-4" aria-hidden />
              Next action
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-3">
        {/* ------------------------------------------------- Summary column */}
        <div className="space-y-4 lg:col-span-1">
          <section className="card p-4">
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {formatMoney(deal.value, deal.currency)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Weighted {formatMoney(deal.weightedValue, deal.currency)} at {deal.probability}%
            </p>

            <div className="mt-4">
              <label className="label" htmlFor="stage-select">
                Stage
              </label>
              <div className="flex items-center gap-2">
                <span className={clsx('h-2 w-2 shrink-0 rounded-full', stageStyle.dot)} aria-hidden />
                <Select
                  id="stage-select"
                  value={deal.stage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  disabled={deal.archived}
                >
                  {stages.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {deal.archived && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                This deal is archived. Restore it to make changes on the board.
              </p>
            )}

            {deal.status === 'lost' && deal.lostReason && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <span className="font-semibold">Lost:</span> {deal.lostReason}
              </p>
            )}

            <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-1">
              <DetailRow icon={UserIcon} label="Owner">
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={deal.owner?.name || '?'} size="xs" />
                  {deal.owner?.name}
                </span>
              </DetailRow>
              <DetailRow icon={Building2} label="Company">
                {deal.company}
              </DetailRow>
              <DetailRow icon={UserIcon} label="Contact">
                {deal.contactName}
              </DetailRow>
              <DetailRow icon={BriefcaseBusiness} label="Designation">
                {deal.contactDesignation}
              </DetailRow>
              <DetailRow icon={Mail} label="Email">
                {deal.contactEmail ? (
                  <a href={`mailto:${deal.contactEmail}`} className="text-brand-600 hover:underline">
                    {deal.contactEmail}
                  </a>
                ) : null}
              </DetailRow>
              <DetailRow icon={Phone} label="Phone">
                {deal.contactPhone ? (
                  <a href={`tel:${deal.contactPhone}`} className="text-brand-600 hover:underline">
                    {deal.contactPhone}
                  </a>
                ) : null}
              </DetailRow>
              <DetailRow icon={CalendarDays} label="Expected close">
                {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : null}
              </DetailRow>
              <DetailRow icon={Tag} label="Source">
                {deal.source}
              </DetailRow>
            </div>

            {deal.contacts?.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs text-slate-500">Additional contacts</p>
                <ul className="space-y-1.5">
                  {deal.contacts.map((c) => (
                    <li key={c.email} className="flex items-start gap-2 text-sm">
                      <Avatar name={c.name || c.email} size="xs" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-1.5">
                          <span className="font-medium text-slate-800">{c.name || c.email}</span>
                          {c.designation && (
                            <span className="text-xs text-slate-500">{c.designation}</span>
                          )}
                        </span>
                        {c.name && (
                          <a
                            href={`mailto:${c.email}`}
                            className="block truncate text-xs text-brand-600 hover:underline"
                          >
                            {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="block truncate text-xs text-brand-600 hover:underline"
                          >
                            {c.phone}
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {deal.description && (
              <p className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm text-slate-600">
                {deal.description}
              </p>
            )}

            <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              Created {formatDateTime(deal.createdAt)}
              {deal.closedAt && ` · Closed ${formatDateTime(deal.closedAt)}`}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <Button variant="secondary" onClick={handleArchiveToggle} className="flex-1">
                {deal.archived ? (
                  <>
                    <ArchiveRestore className="h-4 w-4" aria-hidden /> Restore
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" aria-hidden /> Archive
                  </>
                )}
              </Button>
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </Button>
            </div>
          </section>

          {/* ------------------------------------------------ Next actions */}
          <section className="card p-4">
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Next actions
                {pending.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                    {pending.length}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingReminder(null);
                  setReminderOpen(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add
              </button>
            </header>

            {pending.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No follow-up scheduled"
                message="Schedule the next step so it lands on your to-do list and in your inbox."
                className="py-6"
              />
            ) : (
              <ul className="space-y-2">
                {pending.map((reminder) => (
                  <ReminderItem
                    key={reminder._id}
                    reminder={reminder}
                    showDeal={false}
                    onChanged={refresh}
                    onEdit={(r) => {
                      setEditingReminder(r);
                      setReminderOpen(true);
                    }}
                  />
                ))}
              </ul>
            )}

            {past.length > 0 && (
              <details className="mt-3 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700">
                  {past.length} completed / cancelled
                </summary>
                <ul className="mt-2 space-y-2">
                  {past.map((reminder) => (
                    <ReminderItem
                      key={reminder._id}
                      reminder={reminder}
                      showDeal={false}
                      onChanged={refresh}
                      onEdit={(r) => {
                        setEditingReminder(r);
                        setReminderOpen(true);
                      }}
                    />
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>

        {/* ---------------------------------------------- Emails column */}
        <section className="card flex flex-col lg:col-span-2">
          <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
            <span className="-mb-px border-b-2 border-brand-600 px-3 py-2 text-sm font-semibold text-brand-700">
              Emails
            </span>
          </div>

          <EmailsTab deal={deal} />
        </section>
      </div>

      <DealFormModal open={editOpen} onClose={() => setEditOpen(false)} deal={deal} />

      <ReminderFormModal
        open={reminderOpen}
        onClose={() => {
          setReminderOpen(false);
          setEditingReminder(null);
        }}
        deal={deal}
        reminder={editingReminder}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this deal?"
        message={`"${deal.title}" and its reminders will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete deal"
      />
    </>
  );
}
