import api from './client';

/** Thin, typed-by-convention wrappers around the REST API. */

export const authApi = {
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data.data),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data.data),
  /** Exchanges a Google ID token for a CRM session. */
  google: (credential) => api.post('/auth/google', { credential }).then((r) => r.data.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data.data.user),
  updateProfile: (payload) => api.patch('/auth/me', payload).then((r) => r.data.data.user),
  changePassword: (payload) => api.post('/auth/change-password', payload).then((r) => r.data),
  // Axios needs the body under `data` for DELETE requests.
  deleteAccount: (payload) => api.delete('/auth/me', { data: payload }).then((r) => r.data),
};

export const stagesApi = {
  list: () => api.get('/stages').then((r) => r.data.data),
  create: (payload) => api.post('/stages', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/stages/${id}`, payload).then((r) => r.data.data),
};

export const dealsApi = {
  board: (params) => api.get('/deals/board', { params }).then((r) => r.data.data.columns),
  stats: () => api.get('/deals/stats').then((r) => r.data.data),
  list: (params) => api.get('/deals', { params }).then((r) => r.data),
  get: (id) => api.get(`/deals/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/deals', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/deals/${id}`, payload).then((r) => r.data.data),
  move: (id, payload) => api.patch(`/deals/${id}/move`, payload).then((r) => r.data.data),
  archive: (id) => api.patch(`/deals/${id}/archive`).then((r) => r.data.data),
  restore: (id) => api.patch(`/deals/${id}/restore`).then((r) => r.data.data),
  remove: (id) => api.delete(`/deals/${id}`).then((r) => r.data),
};

export const remindersApi = {
  list: (params) => api.get('/reminders', { params }).then((r) => r.data),
  create: (payload) => api.post('/reminders', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/reminders/${id}`, payload).then((r) => r.data.data),
  complete: (id) => api.post(`/reminders/${id}/complete`).then((r) => r.data.data),
  remove: (id) => api.delete(`/reminders/${id}`).then((r) => r.data),
};

export const notesApi = {
  list: (params) => api.get('/notes', { params }).then((r) => r.data),
  create: (payload) => api.post('/notes', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/notes/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/notes/${id}`).then((r) => r.data),
};

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data.data),
};

export const metaApi = {
  get: () => api.get('/meta').then((r) => r.data.data),
};
