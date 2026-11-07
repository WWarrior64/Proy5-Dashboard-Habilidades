import api from './api.js'

export const colaboradoresService = {
  list: (params) => api.get('/colaboradores', { params }),
  get: (id) => api.get(`/colaboradores/${id}`),
  create: (data) => api.post('/colaboradores', data),
  update: (id, data) => api.put(`/colaboradores/${id}`, data),
  remove: (id) => api.delete(`/colaboradores/${id}`),
  changeStatus: (id, data) => api.patch(`/colaboradores/${id}/estado`, data),
}