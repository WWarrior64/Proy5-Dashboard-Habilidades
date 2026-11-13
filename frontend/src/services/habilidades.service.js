import api from './api.js'
import { fetchAllPages } from '../utils/apiResponses.js'

export const habilidadesService = {
  list: (params) => api.get('/habilidades', { params }),
  listAll: (filters = {}) => fetchAllPages(page => api.get('/habilidades', { params: { ...filters, ...page } })),
  get: (id) => api.get(`/habilidades/${id}`),
  create: (data) => api.post('/habilidades', data),
  update: (id, data) => api.put(`/habilidades/${id}`, data),
  remove: (id) => api.patch(`/habilidades/${encodeURIComponent(id)}/estado`, { activo: false }),
}