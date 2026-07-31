import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Bell, KeyRound, UserRound } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Avatar, Button, Field, Input } from '@/components/ui';
import MailboxSettings from '@/components/emails/MailboxSettings';
import DeleteAccountCard from '@/components/settings/DeleteAccountCard';
import { authApi } from '@/api/endpoints';
import { setAccessToken, errorMessage } from '@/api/client';
import { selectUser, updateProfile } from '@/features/auth/authSlice';

export default function Settings() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const [name, setName] = useState(user?.name || '');
  const [prefs, setPrefs] = useState({
    emailReminders: user?.notificationPrefs?.emailReminders ?? true,
    dailyDigest: user?.notificationPrefs?.dailyDigest ?? true,
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setPrefs({
      emailReminders: user?.notificationPrefs?.emailReminders ?? true,
      dailyDigest: user?.notificationPrefs?.dailyDigest ?? true,
    });
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await dispatch(updateProfile({ name: name.trim(), notificationPrefs: prefs })).unwrap();
      toast.success('Settings saved');
    } catch (message) {
      toast.error(message || 'Could not save your settings');
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordSaving(true);
    try {
      const res = await authApi.changePassword(passwords);
      // The server rotates every token; adopt the fresh one so we stay signed in.
      if (res?.data?.accessToken) setAccessToken(res.data.accessToken);
      setPasswords({ currentPassword: '', newPassword: '' });
      toast.success('Password updated — other sessions have been signed out');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPasswordSaving(false);
    }
  };

  const Toggle = ({ label, hint, checked, onChange }) => (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span className="text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile, notifications and password." />

      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
        <section className="card p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={user?.name || '?'} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <UserRound className="h-4 w-4 text-slate-400" aria-hidden />
              Profile
            </h2>

            <Field label="Full name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </Field>

            <h2 className="flex items-center gap-2 pt-2 text-sm font-semibold text-slate-900">
              <Bell className="h-4 w-4 text-slate-400" aria-hidden />
              Email notifications
            </h2>

            <div className="space-y-2">
              <Toggle
                label="Reminder emails"
                hint="One email shortly before each next action is due."
                checked={prefs.emailReminders}
                onChange={(v) => setPrefs((p) => ({ ...p, emailReminders: v }))}
              />
              <Toggle
                label="Daily digest"
                hint="A morning summary of overdue and upcoming tasks."
                checked={prefs.dailyDigest}
                onChange={(v) => setPrefs((p) => ({ ...p, dailyDigest: v }))}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={profileSaving}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

        <MailboxSettings />

        <section className="card p-4 sm:p-5">
          <form onSubmit={changePassword} className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <KeyRound className="h-4 w-4 text-slate-400" aria-hidden />
              Change password
            </h2>

            <Field label="Current password" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords((p) => ({ ...p, currentPassword: e.target.value }))
                }
                required
              />
            </Field>

            <Field
              label="New password"
              required
              hint="At least 8 characters, with upper and lower case letters and a number."
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
                required
                minLength={8}
              />
            </Field>

            <div className="flex justify-end">
              <Button type="submit" variant="secondary" loading={passwordSaving}>
                Update password
              </Button>
            </div>
          </form>
        </section>

        <DeleteAccountCard />
      </div>
    </>
  );
}
