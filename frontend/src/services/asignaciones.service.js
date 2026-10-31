import api from './api.js'

export const asignacionesService = {
  list: (params) => api.get('/asignaciones', { params }),
  get: (id) => api.get(`/asignaciones/${id}`),
  create: (data) => api.post('/asignaciones', data),
  update: (id, data) => api.put(`/asignaciones/${id}`, data),
  remove: (id) => api.delete(`/asignaciones/${id}`),
}