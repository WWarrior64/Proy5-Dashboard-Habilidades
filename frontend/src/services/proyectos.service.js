import api from './api.js'

// DynamoDB consulta por GSI: el backend requiere estado o liderId.
export const ESTADOS_PROYECTO = ['BORRADOR', 'ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO']

export const proyectosService = {
  list: async (params = {}) => {
    const filters = Object.fromEntries(Object.entries(params || {}).filter(([, value]) => value !== '' && value != null))
    if (filters.estado || filters.liderId) {
      return api.get('/proyectos', { params: filters })
    }
    // No existe GET /proyectos sin filtros en la API actual. Consultamos cada estado.
    // El formato sigue siendo { data: { success, datos: [...] } } para las pantallas.
    const responses = await Promise.all(
      ESTADOS_PROYECTO.map((estado) => api.get('/proyectos', { params: { ...filters, estado } }))
    )
    const proyectos = responses.flatMap(({ data }) => Array.isArray(data?.datos) ? data.datos : [])
    const unique = [...new Map(proyectos.map((item) => [item.proyectoId, item])).values()]
    return { data: { success: true, datos: unique } }
  },
  get: (id) => api.get(`/proyectos/${encodeURIComponent(id)}`),
  create: (data) => api.post('/proyectos', data),
  update: (id, data) => api.put(`/proyectos/${encodeURIComponent(id)}`, data),
  remove: (id) => api.delete(`/proyectos/${encodeURIComponent(id)}`),
  changeStatus: (id, data) => api.patch(`/proyectos/${encodeURIComponent(id)}/estado`, data),
}
