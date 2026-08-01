import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { KanbanSquare } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import {
  clearAuthError,
  login,
  loginWithGoogle,
  selectAuthError,
  selectAuthStatus,
  selectUser,
} from '@/features/auth/authSlice';
import { googleAuthConfigured } from '@/utils/googleIdentity';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const status = useSelector(selectAuthStatus);
  const error = useSelector(selectAuthError);

  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => {
    if (user) navigate(location.state?.from || '/', { replace: true });
  }, [user, navigate, location.state]);

  useEffect(() => () => dispatch(clearAuthError()), [dispatch]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(login({ email: form.email.trim(), password: form.password }));
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white">
            <KanbanSquare className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Sign in to Spector.AI CRM</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track deals, move them forward, never miss a follow-up.
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

          <Field label="Email" required>
            <Input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </Field>

          <Field label="Password" required>
            <Input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              required
            />
          </Field>

          <Button type="submit" className="w-full" loading={status === 'loading'}>
            Sign in
          </Button>

          {/* In dev the section stays visible when unconfigured, so the missing
              client id is obvious rather than silently absent. */}
          {(googleAuthConfigured || import.meta.env.DEV) && (
            <>
              <div className="flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  or
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Signs in with a Google account, creating one on first use. */}
              <GoogleSignInButton
                busy={status === 'loading'}
                onCredential={(credential) => dispatch(loginWithGoogle(credential))}
              />
            </>
          )}

          <p className="text-center text-sm text-slate-500">
            No account yet?{' '}
            <Link to="/register" className="font-semibold text-brand-600 hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
