import axios from 'axios';

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * The access token lives in memory only — never localStorage — so an XSS bug
 * cannot read it back out. Sessions survive a refresh via the httpOnly refresh
 * cookie, which the bootstrap call exchanges for a fresh access token.
 */
let accessToken = null;
let onSessionExpired = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true, // send/receive the refresh cookie
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/** Refresh calls are de-duplicated: parallel 401s wait on one refresh. */
let refreshPromise = null;

const refreshAccessToken = () => {
  if (!refreshPromise) {
    // Body must be `{}`, not null: axios serialises null to the string "null",
    // which express.json() rejects with a 400 before the route is even reached.
    refreshPromise = api
      .post('/auth/refresh', {}, { skipAuthRefresh: true })
      .then((res) => {
        const token = res.data?.data?.accessToken;
        setAccessToken(token || null);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (!response) {
      return Promise.reject(
        Object.assign(error, {
          normalizedMessage:
            error.code === 'ECONNABORTED'
              ? 'The request timed out. Please try again.'
              : 'Cannot reach the server. Check your connection.',
        })
      );
    }

    const isAuthRoute = config?.url?.includes('/auth/refresh') || config?.url?.includes('/auth/login');

    // One retry per request, and never for the refresh call itself.
    if (response.status === 401 && !config._retried && !config.skipAuthRefresh && !isAuthRoute) {
      config._retried = true;
      try {
        const token = await refreshAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        }
      } catch {
        /* fall through to session-expired handling */
      }
      setAccessToken(null);
      onSessionExpired();
    }

    const data = response.data || {};
    error.normalizedMessage =
      data.message ||
      (Array.isArray(data.details) && data.details[0]?.message) ||
      `Request failed (${response.status})`;
    error.details = data.details;

    return Promise.reject(error);
  }
);

/** Pulls a displayable message off any error shape. */
export const errorMessage = (error) =>
  error?.normalizedMessage ||
  error?.response?.data?.message ||
  error?.message ||
  'Something went wrong';

export const bootstrapSession = () => refreshAccessToken();

export default api;
