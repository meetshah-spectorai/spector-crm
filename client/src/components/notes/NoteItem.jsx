import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Check, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, Textarea } from '@/components/ui';
import { deleteNote, updateNote } from '@/features/notes/notesSlice';
import { selectUser } from '@/features/auth/authSlice';
import { formatDateTime, timeAgo } from '@/utils/format';

/**
 * One entry in a deal's note log. Editing and deleting are the author's own —
 * the server enforces the same rule, this just hides what would be refused.
 */
export default function NoteItem({ note }) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAuthor = note.author?._id === user?._id;
  const authorName = note.author?.name || 'Removed user';

  const run = async (thunk, successMessage) => {
    setBusy(true);
    try {
      await dispatch(thunk).unwrap();
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (message) {
      toast.error(message || 'Could not update the note');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    const body = draft.trim();
    if (!body) {
      toast.error('A note cannot be empty');
      return;
    }
    if (body === note.body) {
      setEditing(false);
      return;
    }
    if (await run(updateNote({ id: note._id, body }), 'Note updated')) setEditing(false);
  };

  return (
    <li
      className={clsx(
        'group rounded-xl border px-3 py-3 transition-colors',
        note.pinned ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
      )}
    >
      <header className="flex items-start gap-2.5">
        <Avatar name={authorName} size="xs" />

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
            <span className="font-semibold text-slate-900">{authorName}</span>
            <span className="text-[11px] text-slate-400" title={formatDateTime(note.createdAt)}>
              {timeAgo(note.createdAt)}
            </span>
            {note.editedAt && (
              <span className="text-[11px] italic text-slate-400" title={formatDateTime(note.editedAt)}>
                edited
              </span>
            )}
          </p>
        </div>

        {note.pinned && !editing && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
            <Pin className="h-3 w-3" aria-hidden />
            Pinned
          </span>
        )}

        {isAuthor && !editing && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  updateNote({ id: note._id, pinned: !note.pinned }),
                  note.pinned ? 'Note unpinned' : 'Note pinned'
                )
              }
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            >
              {note.pinned ? (
                <PinOff className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Pin className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(note.body);
                setEditing(true);
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Edit note"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Delete note"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
      </header>

      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            maxLength={5000}
            autoFocus
            aria-label="Edit note"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(note.body);
                setEditing(false);
              }}
              disabled={busy}
            >
              <X className="h-4 w-4" aria-hidden />
              Cancel
            </Button>
            <Button onClick={saveEdit} loading={busy}>
              <Check className="h-4 w-4" aria-hidden />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 whitespace-pre-wrap break-words pl-[34px] text-sm text-slate-700">
          {note.body}
        </p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          run(deleteNote(note._id), 'Note deleted');
        }}
        title="Delete this note?"
        message="The note will be permanently removed from this deal."
        confirmLabel="Delete"
        loading={busy}
      />
    </li>
  );
}
