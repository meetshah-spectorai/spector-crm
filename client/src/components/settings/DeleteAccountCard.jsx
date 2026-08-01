import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import { deleteMyAccount, selectUser } from '@/features/auth/authSlice';
import { fetchUsers, selectUsers } from '@/features/users/usersSlice';

/**
 * Self-service account deletion.
 *
 * There are no admins, so this is how someone leaves. Deals and open tasks must
 * be handed to a named teammate — the API refuses otherwise — so nothing is left
 * orphaned in the shared pipeline.
 */
export default function DeleteAccountCard() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const users = useSelector(selectUsers);

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const teammates = useMemo(() => users.filter((u) => u._id !== user?._id), [users, user]);

  useEffect(() => {
    if (open) {
      dispatch(fetchUsers());
      setPassword('');
      setTransferTo('');
      setConfirmText('');
      setError(null);
    }
  }, [open, dispatch]);

  const canSubmit = password.length > 0 && confirmText.trim().toUpperCase() === 'DELETE';

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      const message = await dispatch(
        deleteMyAccount({ password, ...(transferTo ? { transferTo } : {}) })
      ).unwrap();
      toast.success(message);
      // The auth slice clears the session; ProtectedRoute redirects to /login.
    } catch (message) {
      setError(message || 'Could not delete the account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-900">
        <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden />
        Delete account
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-rose-800/80">
        Permanently deletes <span className="font-semibold">{user?.email}</span>. Your deals and
        open tasks are handed to a teammate you choose; any mailbox you connected is disconnected
        and its synced emails removed. This cannot be undone.
      </p>

      <div className="mt-3">
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete my account
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Delete your account?"
        description="This is permanent. Please confirm the details below."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="delete-account-form"
              variant="danger"
              loading={busy}
              disabled={!canSubmit}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <form id="delete-account-form" onSubmit={submit} className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
            >
              {error}
            </p>
          )}

          <Field
            label="Hand my deals and tasks to"
            hint={
              teammates.length
                ? 'Required if you own any deals or open tasks.'
                : 'No other accounts exist yet — the API will refuse to delete the only account.'
            }
          >
            <Select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              disabled={teammates.length === 0}
            >
              <option value="">Nobody (only works if you own nothing)</option>
              {teammates.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Your password" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>

          {/* A typed confirmation makes this hard to trigger by accident. */}
          <Field label='Type "DELETE" to confirm' required>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoCapitalize="characters"
            />
          </Field>
        </form>
      </Modal>
    </section>
  );
}
