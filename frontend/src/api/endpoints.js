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
  move: (id, payload) => api.patch(`/api/tasks/${id}/move`, payload),
  share: (id, payload) => api.patch(`/api/tasks/${id}/share`, payload)
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

export const statusesApi = {
  list: (projectId) => api.get(`/api/projects/${projectId}/statuses`),
  create: (projectId, payload) => api.post(`/api/projects/${projectId}/statuses`, payload),
  update: (statusId, payload) => api.patch(`/api/statuses/${statusId}`, payload),
  remove: (statusId) => api.delete(`/api/statuses/${statusId}`)
};

export const roadmapApi = {
  get: (projectId) => api.get(`/api/projects/${projectId}/roadmap`, { silent: true })
};

export const gatesApi = {
  create: (projectId, payload) => api.post(`/api/projects/${projectId}/gates`, payload),
  update: (gateId, payload) => api.patch(`/api/gates/${gateId}`, payload),
  remove: (gateId, payload) => api.delete(`/api/gates/${gateId}`, { data: payload }),
  close: (gateId, payload) => api.post(`/api/gates/${gateId}/close`, payload),
  reopen: (gateId, payload) => api.post(`/api/gates/${gateId}/reopen`, payload),
  bulkImport: (projectId, rows) => api.post(`/api/projects/${projectId}/gates/bulk-import`, { rows }),
  share: (gateId, payload) => api.patch(`/api/gates/${gateId}/share`, payload)
};

export const boardApi = {
  get: (projectId, gateId) => api.get(`/api/projects/${projectId}/board`, { params: gateId ? { gateId } : {} }),
  updateTask: (taskId, payload) => api.patch(`/api/tasks/${taskId}/board`, payload),
  addGatePlacement: (taskId, gateId) => api.post(`/api/tasks/${taskId}/gate-placements`, { gateId }),
  taskRoadmaps: (taskId) => api.get(`/api/tasks/${taskId}/roadmaps`, { silent: true })
};

export const tagsApi = {
  list: (projectId) => api.get(`/api/projects/${projectId}/tags`),
  create: (projectId, payload) => api.post(`/api/projects/${projectId}/tags`, payload),
  remove: (tagId) => api.delete(`/api/tags/${tagId}`)
};

export const searchApi = {
  query: (q) => api.get('/api/search', { params: { q }, silent: true })
};

export const meApi = {
  tasks: () => api.get('/api/me/tasks')
};

export const trashApi = {
  list: (projectId) => api.get('/api/trash', { params: projectId ? { projectId } : {} }),
  restore: (type, id) => api.post(`/api/trash/${type}/${id}/restore`)
};

export const activityApi = {
  list: (taskId) => api.get(`/api/tasks/${taskId}/activity`, { silent: true })
};

export const docCategoriesApi = {
  list: (projectId) => api.get(`/api/projects/${projectId}/categories`),
  create: (projectId, payload) => api.post(`/api/projects/${projectId}/categories`, payload),
  rename: (catId, name) => api.patch(`/api/categories/${catId}`, { name }),
  remove: (projectId, catId, payload) => api.delete(`/api/categories/${catId}`, { data: payload })
};

export const docsApi = {
  list: (projectId, params) => api.get(`/api/projects/${projectId}/docs`, { params }),
  create: (projectId, payload) => api.post(`/api/projects/${projectId}/docs`, payload),
  detail: (projectId, docId) => api.get(`/api/projects/${projectId}/docs/${docId}`),
  update: (projectId, docId, payload) => api.patch(`/api/projects/${projectId}/docs/${docId}`, payload),
  remove: (projectId, docId) => api.delete(`/api/projects/${projectId}/docs/${docId}`),
  linkedTasks: (projectId, docId) => api.get(`/api/projects/${projectId}/docs/${docId}/tasks`, { silent: true })
};

export const taskDocLinksApi = {
  list: (projectId, taskId) => api.get(`/api/projects/${projectId}/tasks/${taskId}/docs`, { silent: true }),
  add: (projectId, taskId, docId) => api.post(`/api/projects/${projectId}/tasks/${taskId}/docs`, { docId }),
  remove: (projectId, taskId, docId) => api.delete(`/api/projects/${projectId}/tasks/${taskId}/docs/${docId}`)
};

export const annotationsApi = {
  list: (projectId, docId) => api.get(`/api/projects/${projectId}/docs/${docId}/annotations`, { silent: true }),
  create: (projectId, docId, payload) => api.post(`/api/projects/${projectId}/docs/${docId}/annotations`, payload),
  remove: (projectId, docId, annotationId) => api.delete(`/api/projects/${projectId}/docs/${docId}/annotations/${annotationId}`)
};

export const promptsApi = {
  list: (projectId, taskId) => api.get(`/api/projects/${projectId}/tasks/${taskId}/prompts`, { silent: true }),
  create: (projectId, taskId, payload) => api.post(`/api/projects/${projectId}/tasks/${taskId}/prompts`, payload),
  markUsed: (promptId) => api.patch(`/api/prompts/${promptId}/mark-used`),
  generate: (taskId) => api.post('/api/prompts/generate', { taskId }, { silent: true })
};

export const syncApi = {
  proposals: (status) => api.get('/api/sync/proposals', { params: { status } }),
  accept: (id) => api.post(`/api/sync/proposals/${id}/accept`),
  dismiss: (id) => api.post(`/api/sync/proposals/${id}/dismiss`)
};
