/**
 * Loader for Google Identity Services (the "Sign in with Google" library).
 *
 * The script is fetched on demand rather than from index.html, so an app with no
 * `VITE_GOOGLE_CLIENT_ID` never talks to Google at all.
 */

const SRC = 'https://accounts.google.com/gsi/client';

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

/** Whether this build has a Google client id, i.e. whether to offer the button. */
export const googleAuthConfigured = Boolean(GOOGLE_CLIENT_ID);

let loader = null;

/** Resolves with `google.accounts.id` once the library is available. */
export function loadGoogleIdentity() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const done = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error('Google Identity Services did not initialise'));
    };
    const fail = () => {
      loader = null; // let a later attempt retry, e.g. after the network returns
      reject(new Error('Could not load Google Identity Services'));
    };

    const existing = document.querySelector(`script[src="${SRC}"]`);
    if (existing) {
      existing.addEventListener('load', done);
      existing.addEventListener('error', fail);
      return;
    }

    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', done);
    script.addEventListener('error', fail);
    document.head.appendChild(script);
  });

  return loader;
}
