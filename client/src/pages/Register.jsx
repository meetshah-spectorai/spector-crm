import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { KanbanSquare } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import {
  clearAuthError,
  register,
  selectAuthError,
  selectAuthStatus,
  selectUser,
} from '@/features/auth/authSlice';

const RULES = [
  { test: (p) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p), label: 'Upper and lower case letters' },
  { test: (p) => /[0-9]/.test(p), label: 'At least one number' },
];

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const status = useSelector(selectAuthStatus);
  const error = useSelector(selectAuthError);

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => () => dispatch(clearAuthError()), [dispatch]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const passwordValid = RULES.every((r) => r.test(form.password));

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!passwordValid) return;
    dispatch(
      register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
    );
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white">
            <KanbanSquare className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Join Spector.AI CRM</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everyone on the team shares the same pipeline and the same access.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-5">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
            >
              {error}
            </p>
          )}

          <Field label="Full name" required>
            <Input value={form.name} onChange={set('name')} placeholder="Alex Kim" required autoFocus />
          </Field>

          <Field label="Email" required>
            <Input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@company.com"
              required
            />
          </Field>

          <Field
            label="Password"
            required
            error={touched && !passwordValid ? 'Please meet all the requirements below' : undefined}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              required
            />
            <ul className="mt-2 space-y-1">
              {RULES.map((rule) => {
                const ok = rule.test(form.password);
                return (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-1.5 text-xs ${
                      ok ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    <span aria-hidden>{ok ? '✓' : '○'}</span>
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          </Field>

          <Button type="submit" className="w-full" loading={status === 'loading'}>
            Create account
          </Button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
