import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Check, Columns3, Pencil, Plus, X } from 'lucide-react';
import { Button, Field, Input, LoadingState, Modal, Select } from '@/components/ui';
import {
  createStage,
  fetchStages,
  selectStages,
  selectStagesSaving,
  selectStagesStatus,
  updateStage,
} from '@/features/stages/stagesSlice';
import { fetchBoard, selectFilters } from '@/features/deals/dealsSlice';
import { colorStyles, OUTCOME_LABELS, STAGE_COLORS, STAGE_OUTCOMES } from '@/utils/constants';

/** Colour picker: a row of swatches, one selected. */
function ColorPicker({ value, onChange, idPrefix }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Column colour">
      {STAGE_COLORS.map((color) => (
        <button
          key={color}
          id={`${idPrefix}-${color}`}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={clsx(
            'h-6 w-6 rounded-full ring-offset-2 transition-transform',
            colorStyles(color).swatch,
            value === color ? 'ring-2 ring-slate-900 scale-110' : 'hover:scale-110'
          )}
        />
      ))}
    </div>
  );
}

/** One existing column: read-only row that flips into an edit form. */
function StageRow({ stage }) {
  const dispatch = useDispatch();
  const saving = useSelector(selectStagesSaving);
  const filters = useSelector(selectFilters);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    label: stage.label,
    outcome: stage.outcome,
    probability: String(stage.probability),
    color: stage.color,
  });

  useEffect(() => {
    setForm({
      label: stage.label,
      outcome: stage.outcome,
      probability: String(stage.probability),
      color: stage.color,
    });
  }, [stage]);

  const styles = colorStyles(stage.color);

  const save = async () => {
    if (form.label.trim().length < 1) {
      toast.error('Give the column a name');
      return;
    }
    try {
      await dispatch(
        updateStage({
          id: stage._id,
          label: form.label.trim(),
          outcome: form.outcome,
          probability: Number(form.probability),
          color: form.color,
        })
      ).unwrap();
      // The board caches column labels, so pull it again to show the new name.
      dispatch(fetchBoard(filters));
      setEditing(false);
      toast.success('Column updated');
    } catch (message) {
      toast.error(message || 'Could not update the column');
    }
  };

  if (!editing) {
    return (
      <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', styles.dot)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{stage.label}</p>
          <p className="text-xs text-slate-500">
            {OUTCOME_LABELS[stage.outcome]} · {stage.probability}% ·{' '}
            {stage.dealCount} {stage.dealCount === 1 ? 'deal' : 'deals'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label={`Rename ${stage.label}`}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-brand-300 bg-brand-50/40 px-3 py-3">
      <div className="space-y-3">
        <Field label="Column name">
          <Input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            maxLength={40}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
            }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Means">
            <Select
              value={form.outcome}
              onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
            >
              {STAGE_OUTCOMES.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Win probability">
            <Input
              type="number"
              min="0"
              max="100"
              value={form.probability}
              onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
              disabled={form.outcome !== 'open'}
            />
          </Field>
        </div>

        <Field label="Colour">
          <ColorPicker
            value={form.color}
            onChange={(color) => setForm((f) => ({ ...f, color }))}
            idPrefix={`edit-${stage._id}`}
          />
        </Field>

        {form.outcome !== stage.outcome && stage.dealCount > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {stage.dealCount} {stage.dealCount === 1 ? 'deal is' : 'deals are'} in this column.
            Changing what it means will update their status too.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
            <X className="h-4 w-4" aria-hidden />
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            <Check className="h-4 w-4" aria-hidden />
            Save
          </Button>
        </div>
      </div>
    </li>
  );
}

const emptyNew = { label: '', outcome: 'open', probability: '10', color: 'slate' };

/**
 * Column management for the Kanban board: add a column, rename or restyle the
 * existing ones. Reordering and deleting are the natural next additions — the
 * API keeps `order` on every stage for exactly that.
 */
export default function ManageColumnsModal({ open, onClose }) {
  const dispatch = useDispatch();
  const stages = useSelector(selectStages);
  const status = useSelector(selectStagesStatus);
  const saving = useSelector(selectStagesSaving);
  const filters = useSelector(selectFilters);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyNew);

  useEffect(() => {
    if (open) {
      dispatch(fetchStages());
      setAdding(false);
      setForm(emptyNew);
    }
  }, [open, dispatch]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) {
      toast.error('Give the column a name');
      return;
    }
    try {
      await dispatch(
        createStage({
          label: form.label.trim(),
          outcome: form.outcome,
          probability: Number(form.probability),
          color: form.color,
        })
      ).unwrap();
      // New column has to appear on the board straight away.
      dispatch(fetchBoard(filters));
      setForm(emptyNew);
      setAdding(false);
      toast.success('Column added');
    } catch (message) {
      toast.error(message || 'Could not add the column');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage board columns"
      description="Add a stage or rename an existing one. Changes show on the board immediately."
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {status === 'loading' && stages.length === 0 ? (
        <LoadingState label="Loading columns…" />
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2">
            {stages.map((stage) => (
              <StageRow key={stage._id} stage={stage} />
            ))}
          </ul>

          {adding ? (
            <form onSubmit={add} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Columns3 className="h-4 w-4 text-slate-400" aria-hidden />
                New column
              </p>

              <Field label="Column name" required>
                <Input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Contract sent"
                  maxLength={40}
                  autoFocus
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Means" hint="Drives the deal's status">
                  <Select
                    value={form.outcome}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        outcome: e.target.value,
                        probability:
                          e.target.value === 'won' ? '100' : e.target.value === 'lost' ? '0' : f.probability,
                      }))
                    }
                  >
                    {STAGE_OUTCOMES.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Win probability">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.probability}
                    onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
                    disabled={form.outcome !== 'open'}
                  />
                </Field>
              </div>

              <Field label="Colour">
                <ColorPicker
                  value={form.color}
                  onChange={(color) => setForm((f) => ({ ...f, color }))}
                  idPrefix="new"
                />
              </Field>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  Add column
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-600"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add column
            </button>
          )}

          <p className="text-xs text-slate-500">
            Renaming a column keeps every deal in it — the deals reference the column
            by a fixed internal id, not its name.
          </p>
        </div>
      )}
    </Modal>
  );
}
