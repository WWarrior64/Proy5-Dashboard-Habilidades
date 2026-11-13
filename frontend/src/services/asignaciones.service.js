import api from './api.js'

export const asignacionesService = {
  list: (params) => api.get('/asignaciones', { params }),
  get: (id) => api.get(`/asignaciones/${encodeURIComponent(id)}`),
  listByProject: (id) => api.get(`/proyectos/${encodeURIComponent(id)}/asignaciones`),
  listByCollaborator: (id) => api.get(`/colaboradores/${encodeURIComponent(id)}/asignaciones`),
  create: (data) => api.post('/asignaciones', data),
  update: (id, data) => api.put(`/asignaciones/${id}`, data),
  remove: (id) => api.delete(`/asignaciones/${id}`),
}