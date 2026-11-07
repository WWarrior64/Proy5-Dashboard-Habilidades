import api from './api.js'

export const usuariosService = {
  list: (params) => api.get('/usuarios', { params }),
  get: (id) => api.get(`/usuarios/${id}`),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.put(`/usuarios/${id}`, data),
  changeRole: (id, data) => api.patch(`/usuarios/${id}/rol`, data),
  changeStatus: (id, data) => api.patch(`/usuarios/${id}/estado`, data),
  getMe: () => api.get('/usuarios/yo'),
}