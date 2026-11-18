import api from './api.js'

// La puntuación y las habilidades coincidentes proceden exclusivamente de la API.
export const busquedaService = {
  colaboradores: ({ proyectoId, habilidades = [], nivelMinimo = 'JUNIOR', considerarDisponibilidad = false, limit = 100 }) => {
    const ids = [...new Set(habilidades.filter(Boolean))]
    if (!ids.length && !proyectoId) return Promise.resolve({ data: { datos: { candidatos: [], total: 0 } } })
    return api.get('/busqueda/colaboradores', {
      params: {
        ...(proyectoId ? { proyectoId } : {}),
        habilidades: ids.join(','),
        nivelMinimo,
        tipoCoincidencia: 'alguna',
        considerarDisponibilidad,
        limit,
      },
    })
  },
}
