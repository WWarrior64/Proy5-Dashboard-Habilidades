import api from './api.js'

export const usuariosService = {
  list: (params) => api.get('/usuarios', { params }),
  get: (id) => api.get(`/usuarios/${id}`),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.put(`/usuarios/${id}`, data),
  remove: (id) => api.delete(`/usuarios/${id}`),
}