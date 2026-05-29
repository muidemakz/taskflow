import { api } from './client';

export const authApi = {
  login: (payload) => api.post('/api/auth/login', payload),
  register: (payload) => api.post('/api/auth/register', payload),
  logout: (payload) => api.post('/api/auth/logout', payload, { silent: true }),
  me: () => api.get('/api/auth/me', { silent: true })
};

export const projectsApi = {
  list: () => api.get('/api/projects'),
  create: (payload) => api.post('/api/projects', payload),
  detail: (id) => api.get(`/api/projects/${id}`),
  update: (id, payload) => api.patch(`/api/projects/${id}`, payload),
  remove: (id) => api.delete(`/api/projects/${id}`),
  share: (id, payload) => api.patch(`/api/projects/${id}/share`, payload),
  createGroup: (id, payload) => api.post(`/api/projects/${id}/groups`, payload),
  createTask: (id, payload) => api.post(`/api/projects/${id}/tasks`, payload)
};

export const groupsApi = {
  update: (id, payload) => api.patch(`/api/groups/${id}`, payload),
  remove: (id) => api.delete(`/api/groups/${id}`),
  ungroup: (id) => api.post(`/api/groups/${id}/ungroup`),
  merge: (payload) => api.post('/api/groups/merge', payload)
};

export const tasksApi = {
  update: (id, payload) => api.patch(`/api/tasks/${id}`, payload),
  remove: (id) => api.delete(`/api/tasks/${id}`),
  move: (id, payload) => api.patch(`/api/tasks/${id}/move`, payload)
};

export const shareApi = {
  detail: (token) => api.get(`/api/share/${token}`, { silent: true })
};

export const adminApi = {
  stats: () => api.get('/api/admin/stats'),
  users: (params) => api.get('/api/admin/users', { params }),
  user: (id) => api.get(`/api/admin/users/${id}`),
  updateUser: (id, payload) => api.patch(`/api/admin/users/${id}`, payload),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}`)
};
