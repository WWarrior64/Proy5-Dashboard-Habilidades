import api from './api.js'
import { fetchAllPages } from '../utils/apiResponses.js'

export const usuariosService = {
  list: (params) => api.get('/usuarios', { params }),
  listAll: (filters = {}) => fetchAllPages(page => api.get('/usuarios', { params: { ...filters, ...page } })),
  get: (id) => api.get(`/usuarios/${id}`),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.put(`/usuarios/${id}`, data),
  changeRole: (id, data) => api.patch(`/usuarios/${id}/rol`, data),
  changeStatus: (id, data) => api.patch(`/usuarios/${id}/estado`, data),
  getMe: () => api.get('/usuarios/yo'),
}