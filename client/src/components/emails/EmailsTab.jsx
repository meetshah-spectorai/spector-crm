import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { AlertTriangle, Mail, MailPlus, Search, Users, X } from 'lucide-react';
import EmailThread from './EmailThread';
import ConnectMailboxModal from './ConnectMailboxModal';
import { Avatar, Button, EmptyState, ErrorState, Input, LoadingState, Spinner } from '@/components/ui';
import {
  fetchDealEmails,
  resetEmails,
  selectEmailFilters,
  selectEmailPaging,
  selectEmailsError,
  selectEmailsReason,
  selectEmailsStatus,
  selectMailboxSummary,
  selectThreadsByContact,
  setEmailFilters,
} from '@/features/emails/emailsSlice';
import { timeAgo } from '@/utils/format';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'received', label: 'Received' },
  { key: 'attachments', label: 'Has attachments' },
  { key: 'unread', label: 'Unread' },
];

/**
 * Read-only email history for a deal.
 *
 * Conversations are grouped by which of the deal's contacts they belong to, and
 * pulled a page at a time as the list scrolls.
 */
export default function EmailsTab({ deal }) {
  const dispatch = useDispatch();
  const groups = useSelector(selectThreadsByContact);
  const status = useSelector(selectEmailsStatus);
  const error = useSelector(selectEmailsError);
  const filters = useSelector(selectEmailFilters);
  const { page, pages, total, loadingMore } = useSelector(selectEmailPaging);
  const mailboxes = useSelector(selectMailboxSummary);
  const reason = useSelector(selectEmailsReason);

  const [searchText, setSearchText] = useState('');
  const [connectOpen, setConnectOpen] = useState(false);
  const sentinel = useRef(null);

  const dealId = deal._id;

  // Reset when moving between deals so one deal never shows another's mail.
  useEffect(() => {
    dispatch(resetEmails());
    setSearchText('');
  }, [dispatch, dealId]);

  useEffect(() => {
    dispatch(fetchDealEmails({ dealId, page: 1, ...filters }));
  }, [dispatch, dealId, filters]);

  // Debounce typing into a single request.
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchText !== filters.search) dispatch(setEmailFilters({ search: searchText }));
    }, 350);
    return () => clearTimeout(id);
  }, [searchText, filters.search, dispatch]);

  const loadMore = useCallback(() => {
    if (loadingMore || page >= pages || status === 'loading') return;
    dispatch(fetchDealEmails({ dealId, page: page + 1, ...filters }));
  }, [dispatch, dealId, filters, loadingMore, page, pages, status]);

  // Infinite scroll: fetch the next page as the sentinel comes into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '240px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const hasMailbox = mailboxes && mailboxes.active > 0;
  const noContact = reason === 'no-contact-email';

  return (
    <div className="flex flex-col">
      {/* ------------------------------------------------------- toolbar */}
      <div className="space-y-2.5 border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search subject, sender, recipient or content…"
              className="pl-9 pr-9"
              aria-label="Search emails"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => dispatch(setEmailFilters({ filter: f.key }))}
              aria-pressed={filters.filter === f.key}
              className={clsx(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                filters.filter === f.key
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
              )}
            >
              {f.label}
            </button>
          ))}

          {total > 0 && (
            <span className="ml-auto text-[11px] text-slate-400">
              {total} conversation{total === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {mailboxes && mailboxes.anyError && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
            A connected mailbox reported a sync error — check Settings → Mailboxes.
          </p>
        )}
      </div>

      {/* --------------------------------------------------------- body */}
      <div className="max-h-[70vh] overflow-y-auto px-4 py-3 scrollbar-thin">
        {status === 'loading' && groups.length === 0 && <LoadingState label="Loading emails…" />}

        {status === 'failed' && (
          <ErrorState
            message={error}
            onRetry={() => dispatch(fetchDealEmails({ dealId, page: 1, ...filters }))}
          />
        )}

        {/* Empty states explain *why* there is nothing, not just that there isn't. */}
        {status === 'succeeded' && groups.length === 0 && noContact && (
          <EmptyState
            icon={Users}
            title="No contact email on this deal"
            message="Email sync matches messages by contact address. Add a contact email to this deal and its history will appear here."
          />
        )}

        {status === 'succeeded' && groups.length === 0 && !noContact && !hasMailbox && (
          <EmptyState
            icon={MailPlus}
            title="No mailbox connected"
            message="Connect Gmail, Outlook or any IMAP mailbox and the CRM will sync the emails exchanged with this deal's contacts."
            action={
              <Button onClick={() => setConnectOpen(true)}>
                <MailPlus className="h-4 w-4" aria-hidden />
                Connect a mailbox
              </Button>
            }
          />
        )}

        {status === 'succeeded' && groups.length === 0 && !noContact && hasMailbox && (
          <EmptyState
            icon={Mail}
            title={
              filters.search || filters.filter !== 'all'
                ? 'No emails match'
                : 'No emails with this contact yet'
            }
            message={
              filters.search || filters.filter !== 'all'
                ? 'Try a different search or filter.'
                : `Nothing found in the connected mailbox${
                    mailboxes.lastSyncAt ? ` (last synced ${timeAgo(mailboxes.lastSyncAt)})` : ''
                  }.`
            }
          />
        )}

        {groups.length > 0 && (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.contactEmail}>
                {/* Grouped by contact so a multi-contact deal stays readable. */}
                <header className="mb-2 flex items-center gap-2">
                  <Avatar name={group.contactName} size="xs" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    {group.contactName}
                  </h3>
                  <span className="truncate text-[11px] text-slate-400">{group.contactEmail}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                    {group.threads.length}
                  </span>
                </header>

                <ul className="space-y-2">
                  {group.threads.map((thread) => (
                    <EmailThread
                      key={`${thread.threadKey}-${thread.contactEmail}`}
                      thread={thread}
                      dealId={dealId}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {/* Infinite-scroll trigger */}
            {page < pages && (
              <div ref={sentinel} className="flex justify-center py-3">
                {loadingMore ? (
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <Spinner className="h-4 w-4" />
                    Loading more…
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={loadMore}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Load more conversations
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ConnectMailboxModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </div>
  );
}
