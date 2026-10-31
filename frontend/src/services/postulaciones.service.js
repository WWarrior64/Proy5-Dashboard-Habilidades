import api from './api.js'

export const postulacionesService = {
  list: (params) => api.get('/postulaciones', { params }),
  get: (id) => api.get(`/postulaciones/${id}`),
  create: (data) => api.post('/postulaciones', data),
  update: (id, data) => api.put(`/postulaciones/${id}`, data),
  remove: (id) => api.delete(`/postulaciones/${id}`),
  responder: (id, data) => api.patch(`/postulaciones/${id}/responder`, data),
}