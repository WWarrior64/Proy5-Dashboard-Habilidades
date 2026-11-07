import api from './api.js'

// Todas las llamadas protegidas deben pasar por el interceptor Cognito de Axios.
export const cargosService = {
  list: (params = {}) => api.get('/cargos', { params }),
  get: (id) => api.get(`/cargos/${encodeURIComponent(id)}`),
}
