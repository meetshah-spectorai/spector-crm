import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ChevronDown,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Inbox,
  MoreHorizontal,
  Paperclip,
  Send,
} from 'lucide-react';
import Linkify from './Linkify';
import { Avatar, Badge } from '@/components/ui';
import { formatEmailDate, formatFileSize } from '@/utils/format';
import { fileKind, splitEmailBody } from '@/utils/emailBody';

/** Sent / Received chip. The only status this feature shows. */
function DirectionChip({ direction }) {
  const sent = direction === 'sent';
  const Icon = sent ? Send : Inbox;
  return (
    <Badge
      className={clsx(
        'shrink-0',
        sent ? 'bg-brand-50 text-brand-700' : 'bg-emerald-50 text-emerald-700'
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {sent ? 'Sent' : 'Received'}
    </Badge>
  );
}

const ATTACHMENT_ICONS = {
  image: FileImage,
  pdf: FileText,
  sheet: FileSpreadsheet,
  doc: FileText,
  archive: FileArchive,
  file: Paperclip,
};

const ATTACHMENT_TONES = {
  image: 'text-violet-500',
  pdf: 'text-rose-500',
  sheet: 'text-emerald-600',
  doc: 'text-sky-600',
  archive: 'text-amber-600',
  file: 'text-slate-400',
};

function AttachmentRow({ attachment }) {
  const kind = fileKind(attachment.filename, attachment.contentType);
  const Icon = ATTACHMENT_ICONS[kind] || Paperclip;

  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <Icon className={clsx('h-4 w-4 shrink-0', ATTACHMENT_TONES[kind])} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-slate-800">
          {attachment.filename}
        </span>
        {attachment.size > 0 && (
          <span className="block text-[11px] tabular-nums text-slate-400">
            {formatFileSize(attachment.size)}
          </span>
        )}
      </span>
    </li>
  );
}

/** From/To/Cc rows in the expanded header. */
function AddressRow({ label, people }) {
  if (!people?.length) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-9 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-700">
        {people.map((p, i) => (
          <span key={`${p.email}-${i}`}>
            {i > 0 && ', '}
            {p.name ? (
              <>
                <span className="font-medium">{p.name}</span>{' '}
                <span className="text-slate-400">&lt;{p.email}&gt;</span>
              </>
            ) : (
              <span className="font-medium">{p.email}</span>
            )}
          </span>
        ))}
      </dd>
    </div>
  );
}

/**
 * One email inside a conversation.
 *
 * Collapsed: a compact summary row. Expanded: a readable message — the new
 * content first, signature de-emphasised, and the quoted reply history behind a
 * toggle so it does not bury what was actually said. Read-only throughout.
 */
export default function EmailCard({ email, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showQuoted, setShowQuoted] = useState(false);

  const from = email.from || {};
  const attachments = email.attachments || [];

  const { paragraphs, signature, quoted } = useMemo(
    () => splitEmailBody(email.bodyText),
    [email.bodyText]
  );

  const senderLabel = from.name || from.email || 'Unknown sender';

  return (
    <article
      className={clsx(
        'overflow-hidden rounded-xl border bg-white transition-colors',
        expanded ? 'border-slate-300 shadow-card' : 'border-slate-200',
        email.isUnread && !expanded && 'border-brand-200 bg-brand-50/20'
      )}
    >
      {/* ------------------------------------------------------- header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-slate-50/60"
      >
        <Avatar name={senderLabel} size="sm" className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold text-slate-900">{senderLabel}</span>
            <DirectionChip direction={email.direction} />
            {email.isUnread && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-brand-500"
                title="Unread in your mailbox"
                aria-label="Unread"
              />
            )}
            <time
              className="ml-auto shrink-0 text-[11px] text-slate-400"
              dateTime={email.sentAt}
              title={new Date(email.sentAt).toString()}
            >
              {formatEmailDate(email.sentAt)}
            </time>
          </div>

          <p
            className={clsx(
              'mt-1 truncate text-sm',
              expanded ? 'font-semibold text-slate-900' : 'text-slate-800'
            )}
          >
            {email.subject}
          </p>

          {!expanded && (
            <>
              {email.preview && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {email.preview}
                </p>
              )}
              {attachments.length > 0 && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
                </p>
              )}
            </>
          )}
        </div>

        <ChevronDown
          className={clsx(
            'mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform',
            expanded && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {/* ------------------------------------------------------- body */}
      {expanded && (
        <div className="border-t border-slate-100">
          <dl className="space-y-1 border-b border-slate-100 bg-slate-50/60 px-3.5 py-2.5 text-xs">
            <AddressRow label="From" people={[from].filter((p) => p.email)} />
            <AddressRow label="To" people={email.to} />
            <AddressRow label="Cc" people={email.cc} />
          </dl>

          <div className="px-3.5 py-3.5">
            {paragraphs.length > 0 ? (
              <div className="space-y-3 text-sm leading-relaxed text-slate-700">
                {paragraphs.map((p, i) => (
                  // whitespace-pre-wrap keeps single newlines (lists, addresses)
                  // while the paragraph split handles the spacing between blocks.
                  <p key={i} className="whitespace-pre-wrap break-words">
                    <Linkify text={p} />
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-slate-400">(no message body)</p>
            )}

            {signature && (
              <div className="mt-4 border-t border-dashed border-slate-200 pt-2.5">
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-400">
                  <Linkify text={signature} />
                </p>
              </div>
            )}

            {quoted && (
              <div className="mt-3">
                {showQuoted ? (
                  <div className="rounded-lg border-l-2 border-slate-200 bg-slate-50 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setShowQuoted(false)}
                      className="mb-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Hide earlier message
                    </button>
                    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-500">
                      <Linkify text={quoted} />
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowQuoted(true)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                    title="Show quoted history"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                    <span className="text-[11px] font-medium">Show earlier message</span>
                  </button>
                )}
              </div>
            )}

            {attachments.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Paperclip className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
                </p>
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {attachments.map((a, i) => (
                    <AttachmentRow key={`${a.filename}-${i}`} attachment={a} />
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-400">
                  File names only — open the message in your mail client to download.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
