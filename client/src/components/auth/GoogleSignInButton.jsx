import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Spinner } from '@/components/ui';
import {
  GOOGLE_CLIENT_ID,
  googleAuthConfigured,
  loadGoogleIdentity,
} from '@/utils/googleIdentity';

/** Google's "G", for the placeholder shown when no client id is configured. */
function GoogleMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17.3z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7a14.6 14.6 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.2-8.4 2.2-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/**
 * Google's own "Continue with Google" button.
 *
 * It has to be rendered by Google's library (it lives in an iframe, which is what
 * lets Google show the account chooser), so this component is a placeholder div
 * that the library fills in. The callback receives a signed ID token, which the
 * API verifies — the browser never sees a password.
 *
 * Renders nothing at all when `VITE_GOOGLE_CLIENT_ID` is unset.
 */
export default function GoogleSignInButton({ onCredential, busy = false }) {
  const holder = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | failed

  // Google keeps the callback it was initialised with, so read the latest one
  // through a ref instead of re-rendering the button on every parent update.
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    if (!googleAuthConfigured) return undefined;

    let cancelled = false;

    loadGoogleIdentity()
      .then((identity) => {
        if (cancelled || !holder.current) return;

        identity.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response?.credential) callback.current?.(response.credential);
          },
        });

        holder.current.replaceChildren(); // no duplicate button on a re-mount
        identity.renderButton(holder.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          // The iframe needs a pixel width; Google caps it at 400.
          width: Math.min(Math.round(holder.current.offsetWidth) || 320, 400),
        });

        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!googleAuthConfigured) {
    // In production an unconfigured button is just noise, so it is not rendered
    // at all. In development, say why it is missing instead of leaving a gap.
    if (!import.meta.env.DEV) return null;

    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-slate-400">
          <GoogleMark className="h-4 w-4 opacity-40" />
          Continue with Google
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Set <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> in{' '}
          <code className="font-mono">client/.env</code> (and{' '}
          <code className="font-mono">GOOGLE_CLIENT_ID</code> in{' '}
          <code className="font-mono">server/.env</code>), then restart. See the README.
        </p>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <p className="text-center text-xs text-slate-500">
        Google sign-in is unavailable right now — use your email and password.
      </p>
    );
  }

  return (
    <div className="relative min-h-[44px]">
      {state === 'loading' && (
        <div className="flex h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs text-slate-500">
          <Spinner className="h-4 w-4" />
          Loading Google sign-in…
        </div>
      )}
      <div
        ref={holder}
        // Google's iframe cannot be disabled, so block clicks while the exchange
        // with our own API is still in flight.
        className={clsx(
          'flex justify-center [color-scheme:light]',
          state !== 'ready' && 'hidden',
          busy && 'pointer-events-none opacity-60'
        )}
      />
    </div>
  );
}
