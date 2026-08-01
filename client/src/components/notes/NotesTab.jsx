import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { NotebookPen, Search, StickyNote, X } from 'lucide-react';
import NoteItem from './NoteItem';
import { Button, EmptyState, ErrorState, Input, LoadingState, Textarea } from '@/components/ui';
import {
  createNote,
  fetchDealNotes,
  resetNotes,
  selectNotes,
  selectNotesError,
  selectNotesSaving,
  selectNotesStatus,
  selectNotesTotal,
} from '@/features/notes/notesSlice';

const MAX_LENGTH = 5000;

/**
 * The note log for a deal: a composer on top, then every note the team has
 * written, pinned first and newest after.
 */
export default function NotesTab({ deal }) {
  const dispatch = useDispatch();
  const notes = useSelector(selectNotes);
  const status = useSelector(selectNotesStatus);
  const error = useSelector(selectNotesError);
  const total = useSelector(selectNotesTotal);
  const saving = useSelector(selectNotesSaving);

  const [body, setBody] = useState('');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');

  const dealId = deal._id;

  // Reset when moving between deals so one deal never shows another's notes.
  useEffect(() => {
    dispatch(resetNotes());
    setSearchText('');
    setSearch('');
    setBody('');
  }, [dispatch, dealId]);

  useEffect(() => {
    dispatch(fetchDealNotes({ dealId, search }));
  }, [dispatch, dealId, search]);

  // Debounce typing into a single request.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchText.trim()), 350);
    return () => clearTimeout(id);
  }, [searchText]);

  const submit = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    try {
      await dispatch(createNote({ dealId, body: text })).unwrap();
      setBody('');
      toast.success('Note added');
    } catch (message) {
      toast.error(message || 'Could not save the note');
    }
  };

  const filtering = Boolean(search);

  return (
    <div className="flex flex-col">
      {/* ------------------------------------------------------- composer */}
      <form onSubmit={submit} className="space-y-2 border-b border-slate-200 px-4 py-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={MAX_LENGTH}
          placeholder="Add a note — what was discussed, agreed or promised…"
          aria-label="New note"
          // Ctrl/Cmd+Enter is the usual "send" for a multiline composer.
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e);
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            {body.length > MAX_LENGTH - 500
              ? `${MAX_LENGTH - body.length} characters left`
              : 'Ctrl + Enter to save'}
          </span>
          <Button type="submit" loading={saving} disabled={!body.trim()}>
            <NotebookPen className="h-4 w-4" aria-hidden />
            Add note
          </Button>
        </div>
      </form>

      {/* --------------------------------------------------------- search */}
      {(total > 0 || filtering) && (
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search notes…"
              className="pl-9 pr-9"
              aria-label="Search notes"
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
          <span className="shrink-0 text-[11px] text-slate-400">
            {total} note{total === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* ----------------------------------------------------------- body */}
      <div className="max-h-[70vh] overflow-y-auto px-4 py-3 scrollbar-thin">
        {status === 'loading' && notes.length === 0 && <LoadingState label="Loading notes…" />}

        {status === 'failed' && (
          <ErrorState message={error} onRetry={() => dispatch(fetchDealNotes({ dealId, search }))} />
        )}

        {status === 'succeeded' && notes.length === 0 && (
          <EmptyState
            icon={StickyNote}
            title={filtering ? 'No notes match' : 'No notes yet'}
            message={
              filtering
                ? 'Try a different search.'
                : 'Keep the deal’s history here — calls, meetings, decisions and anything the next person needs to know.'
            }
          />
        )}

        {notes.length > 0 && (
          <ul className="space-y-2">
            {notes.map((note) => (
              <NoteItem key={note._id} note={note} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
