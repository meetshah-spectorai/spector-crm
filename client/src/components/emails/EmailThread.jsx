import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { ChevronRight, Inbox, MessagesSquare, Paperclip, Send } from 'lucide-react';
import EmailCard from './EmailCard';
import { ErrorState, Spinner } from '@/components/ui';
import {
  fetchThread,
  selectEmailFilters,
  selectOpenThreads,
  toggleThread,
} from '@/features/emails/emailsSlice';
import { formatEmailDate } from '@/utils/format';

/**
 * One conversation, collapsed to a summary row. Expanding fetches the full
 * message list on demand — conversations are never loaded until opened, which
 * keeps a deal with a long email history fast.
 */
export default function EmailThread({ thread, dealId }) {
  const dispatch = useDispatch();
  const openThreads = useSelector(selectOpenThreads);
  const filters = useSelector(selectEmailFilters);

  const open = Boolean(openThreads[thread.threadKey]);
  const state = openThreads[thread.threadKey];

  const load = () =>
    dispatch(fetchThread({ threadKey: thread.threadKey, dealId, ...filters }));

  const toggle = () => {
    dispatch(toggleThread(thread.threadKey));
    // Fetch on first open only; messages stay cached until the filter changes.
    if (!open && !state?.messages?.length) load();
  };

  const LastIcon = thread.lastDirection === 'sent' ? Send : Inbox;

  return (
    <li
      className={clsx(
        'overflow-hidden rounded-xl border bg-white transition-colors',
        open ? 'border-brand-300 shadow-card' : 'border-slate-200 hover:border-slate-300'
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
      >
        <ChevronRight
          className={clsx(
            'mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-90'
          )}
          aria-hidden
        />

        <span
          className={clsx(
            'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
            thread.lastDirection === 'sent'
              ? 'bg-brand-50 text-brand-600'
              : 'bg-emerald-50 text-emerald-600'
          )}
        >
          <LastIcon className="h-3.5 w-3.5" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span
              className={clsx(
                'min-w-0 truncate text-sm',
                thread.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
              )}
            >
              {thread.subject}
            </span>
            <time
              className="shrink-0 text-[11px] text-slate-400"
              dateTime={thread.lastAt}
              title={new Date(thread.lastAt).toString()}
            >
              {formatEmailDate(thread.lastAt)}
            </time>
          </span>

          {!open && thread.preview && (
            <span className="mt-1 block line-clamp-1 text-xs text-slate-500">{thread.preview}</span>
          )}

          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MessagesSquare className="h-3 w-3" aria-hidden />
              {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
            </span>
            {thread.hasAttachments && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3 w-3" aria-hidden />
                {thread.attachmentCount || 1}
              </span>
            )}
            {thread.unreadCount > 0 && (
              <span className="rounded-full bg-brand-100 px-1.5 py-0.5 font-semibold text-brand-700">
                {thread.unreadCount} unread
              </span>
            )}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-2.5 py-2.5">
          {state?.status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
              <Spinner className="h-4 w-4" />
              Loading conversation…
            </div>
          )}

          {state?.status === 'failed' && (
            <ErrorState message={state.error || 'Could not load this conversation'} onRetry={load} />
          )}

          {state?.status === 'succeeded' && (
            <>
              {/* Says plainly when a filter is hiding part of the conversation. */}
              {state.meta?.filtered && (
                <p className="mb-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-slate-500">
                  Showing {state.meta.shown} of {state.meta.totalInThread} messages in this
                  conversation — the current filter hides the rest.
                </p>
              )}

              <ul className="space-y-2">
                {state.messages.map((email, i) => (
                  <li key={email._id}>
                    {/* Newest message opens expanded; earlier ones stay collapsed
                        so the reply chain is available but not overwhelming. */}
                    <EmailCard email={email} defaultExpanded={i === state.messages.length - 1} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}
