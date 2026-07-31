import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ExternalLink, Info, Lock } from 'lucide-react';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import {
  connectMailAccount,
  fetchMailAccounts,
  selectMailAccountsMeta,
  selectMailAccountsSaving,
} from '@/features/emails/emailsSlice';

const empty = {
  provider: 'gmail',
  email: '',
  password: '',
  host: '',
  port: 993,
  authUser: '',
};

/**
 * Connects a mailbox for read-only sync. Credentials are verified against the
 * mail server before anything is stored, so a wrong app password fails here.
 */
export default function ConnectMailboxModal({ open, onClose }) {
  const dispatch = useDispatch();
  const meta = useSelector(selectMailAccountsMeta);
  const saving = useSelector(selectMailAccountsSaving);

  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const providers = meta?.providers || [];
  const selected = providers.find((p) => p.key === form.provider);

  useEffect(() => {
    if (!open) return;
    if (!meta) dispatch(fetchMailAccounts());
    setForm(empty);
    setErrors({});
  }, [open, meta, dispatch]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();

    const found = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) found.email = 'Enter the mailbox address';
    if (!form.password) found.password = 'Enter the app password';
    if (selected?.needsHost && !form.host.trim()) found.host = 'Enter the IMAP host';
    setErrors(found);
    if (Object.keys(found).length) return;

    try {
      const payload = {
        provider: form.provider,
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };
      if (selected?.needsHost) {
        payload.host = form.host.trim();
        payload.port = Number(form.port) || 993;
      }
      if (form.authUser.trim()) payload.authUser = form.authUser.trim();

      const res = await dispatch(connectMailAccount(payload)).unwrap();
      toast.success(
        res?.meta?.sentFolder
          ? 'Mailbox connected — syncing in the background'
          : 'Mailbox connected (no Sent folder found; received mail only)'
      );
      onClose();
    } catch (message) {
      toast.error(message || 'Could not connect the mailbox');
    }
  };

  const keyMissing = meta && meta.encryptionConfigured === false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect a mailbox"
      description="Read-only sync of the emails exchanged with your contacts."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="mailbox-form" loading={saving} disabled={keyMissing}>
            Connect
          </Button>
        </>
      }
    >
      {keyMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          <p className="font-semibold">Server setup needed first</p>
          <p className="mt-1 text-xs leading-relaxed">
            Mailbox passwords are encrypted at rest, which needs an encryption key. Add this to{' '}
            <code className="rounded bg-amber-100 px-1">server/.env</code> and restart the API:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-white px-2.5 py-2 text-[11px] text-slate-700">
            MAIL_ENCRYPTION_KEY=&lt;64 hex characters&gt;
          </pre>
          <p className="mt-2 text-xs">Generate one with:</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-white px-2.5 py-2 text-[11px] text-slate-700">
            node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
          </pre>
        </div>
      ) : (
        <form id="mailbox-form" onSubmit={submit} className="space-y-4">
          <Field label="Provider">
            <Select value={form.provider} onChange={set('provider')}>
              {providers.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          {selected?.credentialHint && (
            <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <span>
                {selected.credentialHint}
                {selected.setupUrl && (
                  <a
                    href={selected.setupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 inline-flex items-center gap-0.5 font-semibold text-brand-600 hover:underline"
                  >
                    Open settings
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </span>
            </p>
          )}

          <Field label="Mailbox address" required error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={set('email')}
              invalid={Boolean(errors.email)}
              placeholder="you@company.com"
              autoComplete="off"
            />
          </Field>

          <Field
            label="App password"
            required
            error={errors.password}
            hint="Stored encrypted (AES-256-GCM) and used only to read mail."
          >
            <Input
              type="password"
              value={form.password}
              onChange={set('password')}
              invalid={Boolean(errors.password)}
              placeholder="••••••••••••••••"
              autoComplete="new-password"
            />
          </Field>

          {selected?.needsHost && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="IMAP host" required error={errors.host} className="sm:col-span-2">
                <Input
                  value={form.host}
                  onChange={set('host')}
                  invalid={Boolean(errors.host)}
                  placeholder="imap.yourprovider.com"
                />
              </Field>
              <Field label="Port">
                <Input type="number" value={form.port} onChange={set('port')} placeholder="993" />
              </Field>
            </div>
          )}

          <Field
            label="Login name"
            hint="Only if your server's username differs from the address."
          >
            <Input value={form.authUser} onChange={set('authUser')} placeholder="(optional)" />
          </Field>

          <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span>
              The CRM only reads mail. It stores messages that involve a contact on one of your
              deals — nothing else from the mailbox is copied, and it never sends, replies or
              deletes.
            </span>
          </p>
        </form>
      )}
    </Modal>
  );
}
