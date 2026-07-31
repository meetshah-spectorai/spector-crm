import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Mail, MailPlus, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import ConnectMailboxModal from './ConnectMailboxModal';
import { Badge, Button, ConfirmDialog, EmptyState, LoadingState } from '@/components/ui';
import {
  disconnectMailAccount,
  fetchMailAccounts,
  selectMailAccounts,
  selectMailAccountsMeta,
  selectMailAccountsSaving,
  selectMailAccountsStatus,
  setMailAccountActive,
  syncMailAccount,
} from '@/features/emails/emailsSlice';
import { timeAgo } from '@/utils/format';

const PROVIDER_LABELS = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  imap: 'IMAP',
};

function StatusBadge({ account }) {
  if (!account.isActive) return <Badge className="bg-slate-100 text-slate-600">Paused</Badge>;
  if (account.lastSyncStatus === 'error') {
    return (
      <Badge className="bg-rose-100 text-rose-700">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Error
      </Badge>
    );
  }
  if (account.lastSyncStatus === 'running') {
    return <Badge className="bg-sky-100 text-sky-700">Syncing…</Badge>;
  }
  if (account.lastSyncStatus === 'ok') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Synced
      </Badge>
    );
  }
  return <Badge className="bg-slate-100 text-slate-600">Not synced yet</Badge>;
}

/** Connected mailboxes, on the Settings page. */
export default function MailboxSettings() {
  const dispatch = useDispatch();
  const accounts = useSelector(selectMailAccounts);
  const meta = useSelector(selectMailAccountsMeta);
  const status = useSelector(selectMailAccountsStatus);
  const saving = useSelector(selectMailAccountsSaving);

  const [connectOpen, setConnectOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    dispatch(fetchMailAccounts());
  }, [dispatch]);

  const run = async (id, thunk, successFallback) => {
    setBusyId(id);
    try {
      const res = await dispatch(thunk).unwrap();
      toast.success(res?.message || successFallback);
    } catch (message) {
      toast.error(message || 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    const target = confirmTarget;
    setConfirmTarget(null);
    await run(target._id, disconnectMailAccount(target._id), 'Mailbox disconnected');
  };

  return (
    <section className="card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Mail className="h-4 w-4 text-slate-400" aria-hidden />
            Mailboxes
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Read-only sync so the Emails tab on a deal shows your conversation history.
            {meta?.syncCron && ` Syncs on "${meta.syncCron}".`}
          </p>
        </div>
        <Button onClick={() => setConnectOpen(true)}>
          <MailPlus className="h-4 w-4" aria-hidden />
          Connect
        </Button>
      </header>

      {status === 'loading' && accounts.length === 0 ? (
        <LoadingState label="Loading mailboxes…" />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={MailPlus}
          title="No mailbox connected"
          message="Connect Gmail, Outlook or any IMAP mailbox to pull in the emails exchanged with your contacts."
          className="py-8"
        />
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a._id}
              className={clsx(
                'rounded-xl border px-3.5 py-3',
                a.lastSyncStatus === 'error' ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{a.email}</p>
                    <Badge className="bg-slate-100 text-slate-600">
                      {PROVIDER_LABELS[a.provider] || a.provider}
                    </Badge>
                    <StatusBadge account={a} />
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    {a.totalMessages || 0} message{a.totalMessages === 1 ? '' : 's'} synced
                    {a.lastSyncAt && ` · last run ${timeAgo(a.lastSyncAt)}`}
                    {a.user?.name && ` · added by ${a.user.name}`}
                  </p>

                  {a.lastSyncStatus === 'error' && a.lastSyncError && (
                    <p className="mt-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-rose-700">
                      {a.lastSyncError}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="secondary"
                    loading={busyId === a._id && saving}
                    onClick={() => run(a._id, syncMailAccount(a._id), 'Synced')}
                    aria-label={`Sync ${a.email} now`}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Sync now
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() =>
                      run(
                        a._id,
                        setMailAccountActive({ id: a._id, isActive: !a.isActive }),
                        a.isActive ? 'Sync paused' : 'Sync resumed'
                      )
                    }
                    aria-label={a.isActive ? `Pause ${a.email}` : `Resume ${a.email}`}
                  >
                    {a.isActive ? (
                      <Pause className="h-4 w-4" aria-hidden />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => setConfirmTarget(a)}
                    aria-label={`Disconnect ${a.email}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConnectMailboxModal open={connectOpen} onClose={() => setConnectOpen(false)} />

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        onConfirm={remove}
        title={`Disconnect ${confirmTarget?.email}?`}
        message="The stored password and every message synced from this mailbox will be removed. Activity log entries stay, since they are part of each deal's history. Nothing in the mailbox itself is touched."
        confirmLabel="Disconnect"
        loading={saving}
      />
    </section>
  );
}
