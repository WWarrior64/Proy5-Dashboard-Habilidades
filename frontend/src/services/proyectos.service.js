import api from './api.js'

export const proyectosService = {
  list: (params) => api.get('/proyectos', { params }),
  get: (id) => api.get(`/proyectos/${id}`),
  create: (data) => api.post('/proyectos', data),
  update: (id, data) => api.put(`/proyectos/${id}`, data),
  remove: (id) => api.delete(`/proyectos/${id}`),
}