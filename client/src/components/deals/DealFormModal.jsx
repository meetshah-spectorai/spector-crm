import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { createDeal, selectSaving, updateDeal } from '@/features/deals/dealsSlice';
import { fetchUsers, selectUsers } from '@/features/users/usersSlice';
import { selectUser } from '@/features/auth/authSlice';
import { fetchStages, selectStages } from '@/features/stages/stagesSlice';
import { CURRENCIES, PRIORITIES } from '@/utils/constants';

const emptyForm = {
  title: '',
  company: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  value: '',
  currency: 'USD',
  stage: 'lead',
  priority: 'medium',
  owner: '',
  source: '',
  expectedCloseDate: '',
  tags: '',
  description: '',
  contacts: [],
};

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

function validate(form) {
  const errors = {};
  if (!form.title.trim() || form.title.trim().length < 2) {
    errors.title = 'Give the deal a name of at least 2 characters';
  }
  if (form.value === '' || Number.isNaN(Number(form.value)) || Number(form.value) < 0) {
    errors.value = 'Enter a value of 0 or more';
  }
  if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
    errors.contactEmail = 'That email address does not look right';
  }
  // Extra contacts must have a valid address — email sync matches on it.
  const badRow = (form.contacts || []).findIndex(
    (c) => c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())
  );
  if (badRow !== -1) errors.contacts = 'One of the additional contact emails is not valid';
  return errors;
}

/**
 * Create/edit dialog for a deal. `deal` present → edit mode.
 * `defaultStage` pre-selects the column the user clicked "Add deal" in.
 */
export default function DealFormModal({ open, onClose, deal, defaultStage = 'lead' }) {
  const dispatch = useDispatch();
  const saving = useSelector(selectSaving);
  const users = useSelector(selectUsers);
  const stages = useSelector(selectStages);
  const currentUser = useSelector(selectUser);

  const isEdit = Boolean(deal);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (users.length === 0) dispatch(fetchUsers());
    if (stages.length === 0) dispatch(fetchStages());

    setErrors({});
    setForm(
      isEdit
        ? {
            title: deal.title || '',
            company: deal.company || '',
            contactName: deal.contactName || '',
            contactEmail: deal.contactEmail || '',
            contactPhone: deal.contactPhone || '',
            value: String(deal.value ?? ''),
            currency: deal.currency || 'USD',
            stage: deal.stage || '',
            priority: deal.priority || 'medium',
            owner: deal.owner?._id || deal.owner || '',
            source: deal.source || '',
            expectedCloseDate: toDateInput(deal.expectedCloseDate),
            tags: (deal.tags || []).join(', '),
            description: deal.description || '',
            contacts: (deal.contacts || []).map((c) => ({ name: c.name || '', email: c.email || '' })),
          }
        : {
            ...emptyForm,
            stage: defaultStage || stages[0]?.key || '',
            owner: currentUser?._id || '',
          }
    );
    // `stages` is intentionally read but not depended on: re-running this when the
    // stage list loads would discard whatever the user has already typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, deal, defaultStage, users.length, currentUser, dispatch]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const stageHint = useMemo(
    () => stages.find((s) => s.key === form.stage)?.probability,
    [stages, form.stage]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      title: form.title.trim(),
      company: form.company.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      value: Number(form.value),
      currency: form.currency,
      stage: form.stage,
      priority: form.priority,
      source: form.source.trim(),
      description: form.description.trim(),
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      expectedCloseDate: form.expectedCloseDate || null,
      contacts: (form.contacts || [])
        .map((c) => ({ name: c.name.trim(), email: c.email.trim().toLowerCase() }))
        .filter((c) => c.email),
    };
    if (form.owner) payload.owner = form.owner;

    try {
      if (isEdit) {
        await dispatch(updateDeal({ id: deal._id, ...payload })).unwrap();
        toast.success('Deal updated');
      } else {
        await dispatch(createDeal(payload)).unwrap();
        toast.success('Deal created');
      }
      onClose();
    } catch (message) {
      toast.error(message || 'Could not save the deal');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit deal' : 'New deal'}
      description={
        isEdit ? deal?.title : 'Track a new opportunity through the pipeline.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="deal-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Create deal'}
          </Button>
        </>
      }
    >
      <form id="deal-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Deal name" required error={errors.title} className="sm:col-span-2">
          <Input
            value={form.title}
            onChange={set('title')}
            invalid={Boolean(errors.title)}
            placeholder="Acme Corp — Platform licence"
            autoFocus
          />
        </Field>

        <Field label="Company">
          <Input value={form.company} onChange={set('company')} placeholder="Acme Corp" />
        </Field>

        <Field label="Source">
          <Input value={form.source} onChange={set('source')} placeholder="Referral, inbound…" />
        </Field>

        <Field label="Value" required error={errors.value}>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="100"
              value={form.value}
              onChange={set('value')}
              invalid={Boolean(errors.value)}
              placeholder="25000"
              className="flex-1"
            />
            <Select value={form.currency} onChange={set('currency')} className="w-28">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </Field>

        <Field
          label="Stage"
          hint={stageHint != null ? `Default win probability ${stageHint}%` : undefined}
        >
          <Select value={form.stage} onChange={set('stage')}>
            {stages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priority">
          <Select value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Owner" hint="Who is working this deal">
          <Select value={form.owner} onChange={set('owner')}>
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

        <Field label="Expected close date">
          <Input type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
        </Field>

        <Field label="Contact name">
          <Input value={form.contactName} onChange={set('contactName')} placeholder="Dana Whitfield" />
        </Field>

        <Field label="Contact email" error={errors.contactEmail}>
          <Input
            type="email"
            value={form.contactEmail}
            onChange={set('contactEmail')}
            invalid={Boolean(errors.contactEmail)}
            placeholder="dana@acme.com"
          />
        </Field>

        <Field label="Contact phone">
          <Input value={form.contactPhone} onChange={set('contactPhone')} placeholder="+1 415 555 0142" />
        </Field>

        {/* Extra people on the deal. Email sync matches conversations against
            every address here, and the Emails tab groups by contact. */}
        <Field
          label="Additional contacts"
          error={errors.contacts}
          hint="Emails with any of these people appear on this deal's Emails tab"
          className="sm:col-span-2"
        >
          <div className="space-y-2">
            {form.contacts.map((c, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={c.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => {
                      const next = [...f.contacts];
                      next[i] = { ...next[i], name: v };
                      return { ...f, contacts: next };
                    });
                  }}
                  placeholder="Name"
                  className="w-1/3"
                  aria-label={`Additional contact ${i + 1} name`}
                />
                <Input
                  type="email"
                  value={c.email}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => {
                      const next = [...f.contacts];
                      next[i] = { ...next[i], email: v };
                      return { ...f, contacts: next };
                    });
                    if (errors.contacts) setErrors((p) => ({ ...p, contacts: undefined }));
                  }}
                  placeholder="email@company.com"
                  className="flex-1"
                  aria-label={`Additional contact ${i + 1} email`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, contacts: f.contacts.filter((_, x) => x !== i) }))
                  }
                  className="shrink-0 rounded-lg px-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                  aria-label={`Remove additional contact ${i + 1}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}

            {form.contacts.length < 20 && (
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, contacts: [...f.contacts, { name: '', email: '' }] }))
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add contact
              </button>
            )}
          </div>
        </Field>

        <Field label="Tags" hint="Comma separated" className="sm:col-span-2">
          <Input value={form.tags} onChange={set('tags')} placeholder="enterprise, licence" />
        </Field>

        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            value={form.description}
            onChange={set('description')}
            rows={3}
            placeholder="Context, next steps, decision makers…"
          />
        </Field>
      </form>
    </Modal>
  );
}
