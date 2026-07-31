import { forwardRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';

/* ------------------------------------------------------------------ Button */

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', loading = false, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(VARIANTS[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------- Form fields */

export function Field({ label, error, hint, required, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={clsx('input', invalid && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500', className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx('input resize-y', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={clsx('input pr-8', className)} {...props}>
      {children}
    </select>
  );
});

/* ------------------------------------------------------------------- Badge */

export function Badge({ className, children, ...props }) {
  return (
    <span className={clsx('badge', className)} {...props}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- Modal */

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  // Escape to close, and prevent the page behind from scrolling.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-lift animate-slide-up sm:rounded-2xl',
          widths[size]
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>

        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ----------------------------------------------------- Confirmation dialog */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

/* ----------------------------------------------------- States & placeholders */

export function Spinner({ className }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-brand-600', className)} aria-hidden />;
}

export function LoadingState({ label = 'Loading…', className }) {
  return (
    <div className={clsx('flex items-center justify-center gap-2 py-12 text-sm text-slate-500', className)}>
      <Spinner />
      {label}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mb-3 rounded-full bg-slate-100 p-3">
          <Icon className="h-6 w-6 text-slate-400" aria-hidden />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }) {
  return (
    <div className={clsx('rounded-xl border border-rose-200 bg-rose-50 px-4 py-3', className)}>
      <p className="text-sm font-medium text-rose-800">{message || 'Something went wrong'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-semibold text-rose-700 underline hover:text-rose-900"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Avatar */

export function Avatar({ name = '?', size = 'md', className }) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm' };
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();

  // Deterministic colour per name so the same person is always the same hue.
  const palette = [
    'bg-brand-100 text-brand-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-800',
    'bg-sky-100 text-sky-700',
    'bg-violet-100 text-violet-700',
    'bg-rose-100 text-rose-700',
  ];
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  return (
    <span
      title={name}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizes[size],
        palette[hash % palette.length],
        className
      )}
    >
      {letters || '?'}
    </span>
  );
}
