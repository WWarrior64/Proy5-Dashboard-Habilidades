import api from './api.js'

// Todas las llamadas protegidas deben pasar por el interceptor Cognito de Axios.
export const cargosService = {
  list: (params = {}) => api.get('/cargos', { params }),
  get: (id) => api.get(`/cargos/${encodeURIComponent(id)}`),
  create: data => api.post('/cargos', data),
  update: (id, data) => api.put(`/cargos/${encodeURIComponent(id)}`, data),
  changeStatus: (id, data) => api.patch(`/cargos/${encodeURIComponent(id)}/estado`, data),
}
