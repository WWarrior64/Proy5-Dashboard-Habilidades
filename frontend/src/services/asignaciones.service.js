import api from './api.js'
import { proyectosService } from './proyectos.service.js'
import { extractItems } from '../utils/apiResponses.js'

export const asignacionesService = {
  list: (params) => api.get('/asignaciones', { params }),
  get: (id) => api.get(`/asignaciones/${encodeURIComponent(id)}`),
  listByProject: (id) => api.get(`/proyectos/${encodeURIComponent(id)}/asignaciones`),
  listByCollaborator: (id) => api.get(`/colaboradores/${encodeURIComponent(id)}/asignaciones`),
  listMine: () => api.get('/asignaciones/mias'),
  listHistory: async () => {
    const proyectos = extractItems((await proyectosService.list()).data)
    const paginas = await Promise.all(proyectos.map(proyecto =>
      api.get(`/proyectos/${encodeURIComponent(proyecto.proyectoId)}/asignaciones`)))
    const items = [...new Map(paginas.flatMap(pagina => extractItems(pagina.data))
      .map(item => [item.asignacionId, item])).values()]
    return { data: { success: true, datos: items } }
  },
  create: (data) => api.post('/asignaciones', data),
  update: (id, data) => api.put(`/asignaciones/${encodeURIComponent(id)}`, data),
  remove: (id) => api.delete(`/asignaciones/${encodeURIComponent(id)}`),
  finish: (id) => api.patch(`/asignaciones/${encodeURIComponent(id)}/estado`, { estado: 'FINALIZADA' }),
}