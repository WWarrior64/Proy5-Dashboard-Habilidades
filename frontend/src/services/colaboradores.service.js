import api from './api.js'
import { fetchAllPages } from '../utils/apiResponses.js'

export const colaboradoresService = {
  list: (params) => api.get('/colaboradores', { params }),
  listAll: (filters = {}) => fetchAllPages(page => api.get('/colaboradores', { params: { ...filters, ...page } })),
  get: (id) => api.get(`/colaboradores/${id}`),
  getMe: () => api.get('/colaboradores/yo'),
  listSkills: (id) => api.get(`/colaboradores/${encodeURIComponent(id)}/habilidades`),
  addSkill: (id, data) => api.post(`/colaboradores/${encodeURIComponent(id)}/habilidades`, data),
  updateSkill: (id, skillId, data) => api.put(`/colaboradores/${encodeURIComponent(id)}/habilidades/${encodeURIComponent(skillId)}`, data),
  removeSkill: (id, skillId) => api.delete(`/colaboradores/${encodeURIComponent(id)}/habilidades/${encodeURIComponent(skillId)}`),
  create: (data) => api.post('/colaboradores', data),
  update: (id, data) => api.put(`/colaboradores/${id}`, data),
  remove: (id) => api.delete(`/colaboradores/${id}`),
  changeStatus: (id, data) => api.patch(`/colaboradores/${id}/estado`, data),
}