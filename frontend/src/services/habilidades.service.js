import api from './api.js'

export const habilidadesService = {
  list: (params) => api.get('/habilidades', { params }),
  get: (id) => api.get(`/habilidades/${id}`),
  create: (data) => api.post('/habilidades', data),
  update: (id, data) => api.put(`/habilidades/${id}`, data),
  remove: (id) => api.delete(`/habilidades/${id}`),
}