import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import {
  createReminder,
  selectRemindersSaving,
  updateReminder,
} from '@/features/reminders/remindersSlice';
import { fetchUsers, selectUsers } from '@/features/users/usersSlice';
import { selectUser } from '@/features/auth/authSlice';
import { PRIORITIES } from '@/utils/constants';
import { defaultReminderDate, toDateTimeLocal } from '@/utils/format';

const LEAD_OPTIONS = [
  { value: 0, label: 'At the due time' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 240, label: '4 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
];

const QUICK_PICKS = [
  { label: 'In 1 hour', get: () => new Date(Date.now() + 60 * 60 * 1000) },
  {
    label: 'Tomorrow 9am',
    get: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'In 3 days',
    get: () => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Next week',
    get: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

/**
 * Create/edit a next action on a deal.
 * `reminder` present → edit mode; otherwise `deal` is required.
 */
export default function ReminderFormModal({ open, onClose, deal, reminder, onSaved }) {
  const dispatch = useDispatch();
  const saving = useSelector(selectRemindersSaving);
  const users = useSelector(selectUsers);
  const currentUser = useSelector(selectUser);

  const isEdit = Boolean(reminder);

  const [form, setForm] = useState({
    title: '',
    notes: '',
    dueAt: defaultReminderDate(),
    priority: 'medium',
    assignedTo: '',
    notifyBeforeMinutes: 30,
    emailNotify: true,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (users.length === 0) dispatch(fetchUsers());

    setErrors({});
    setForm(
      isEdit
        ? {
            title: reminder.title || '',
            notes: reminder.notes || '',
            dueAt: toDateTimeLocal(reminder.dueAt),
            priority: reminder.priority || 'medium',
            assignedTo: reminder.assignedTo?._id || reminder.assignedTo || '',
            notifyBeforeMinutes: reminder.notifyBeforeMinutes ?? 30,
            emailNotify: reminder.emailNotify ?? true,
          }
        : {
            title: '',
            notes: '',
            dueAt: defaultReminderDate(),
            priority: 'medium',
            assignedTo: deal?.owner?._id || deal?.owner || currentUser?._id || '',
            notifyBeforeMinutes: 30,
            emailNotify: true,
          }
    );
  }, [open, isEdit, reminder, deal, users.length, currentUser, dispatch]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const found = {};
    if (form.title.trim().length < 2) found.title = 'Describe the next action';
    if (!form.dueAt) found.dueAt = 'Pick a date and time';
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      title: form.title.trim(),
      notes: form.notes.trim(),
      dueAt: new Date(form.dueAt).toISOString(),
      priority: form.priority,
      notifyBeforeMinutes: Number(form.notifyBeforeMinutes),
      emailNotify: form.emailNotify,
    };
    if (form.assignedTo) payload.assignedTo = form.assignedTo;

    try {
      if (isEdit) {
        await dispatch(updateReminder({ id: reminder._id, ...payload })).unwrap();
        toast.success('Reminder updated');
      } else {
        await dispatch(createReminder({ ...payload, deal: deal._id })).unwrap();
        toast.success('Reminder scheduled');
      }
      onSaved?.();
      onClose();
    } catch (message) {
      toast.error(message || 'Could not save the reminder');
    }
  };

  const dealTitle = reminder?.deal?.title || deal?.title;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit next action' : 'Schedule next action'}
      description={dealTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="reminder-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Schedule'}
          </Button>
        </>
      }
    >
      <form id="reminder-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="What needs to happen?" required error={errors.title}>
          <Input
            value={form.title}
            onChange={set('title')}
            invalid={Boolean(errors.title)}
            placeholder="Follow-up call with Dana"
            autoFocus
          />
        </Field>

        <Field label="Due" required error={errors.dueAt}>
          <Input
            type="datetime-local"
            value={form.dueAt}
            onChange={set('dueAt')}
            invalid={Boolean(errors.dueAt)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_PICKS.map((pick) => (
              <button
                key={pick.label}
                type="button"
                onClick={() => setForm((f) => ({ ...f, dueAt: toDateTimeLocal(pick.get()) }))}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
              >
                {pick.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Priority">
            <Select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Assigned to">
            <Select value={form.assignedTo} onChange={set('assignedTo')}>
              <option value="">{currentUser?.name} (me)</option>
              {users
                .filter((u) => u._id !== currentUser?._id)
                .map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={set('notes')}
            rows={2}
            placeholder="Talking points, links, context…"
          />
        </Field>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={form.emailNotify}
              onChange={set('emailNotify')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Email me a reminder</span>
              <span className="block text-xs text-slate-500">
                Sent once, shortly before the task is due.
              </span>
            </span>
          </label>

          {form.emailNotify && (
            <div className="mt-3 pl-7">
              <Select
                value={form.notifyBeforeMinutes}
                onChange={set('notifyBeforeMinutes')}
                className="max-w-xs"
                aria-label="When to send the email"
              >
                {LEAD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
