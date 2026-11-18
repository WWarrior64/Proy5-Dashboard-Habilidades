import api from './api.js'
import { proyectoEditable, estadosPermitidos, puedeQuitarRequisito } from '../utils/proyectoEstados.js'
import { extractItems } from '../utils/apiResponses.js'
export { proyectoEditable, estadosPermitidos, puedeQuitarRequisito } from '../utils/proyectoEstados.js'

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
  listRequirements: (id) => api.get(`/proyectos/${encodeURIComponent(id)}/habilidades`),
  addRequirement: (id, data) => api.post(`/proyectos/${encodeURIComponent(id)}/habilidades`, data),
  updateRequirement: (id, habilidadId, data) =>
    api.put(`/proyectos/${encodeURIComponent(id)}/habilidades/${encodeURIComponent(habilidadId)}`, data),
  removeRequirement: (id, habilidadId) =>
    api.delete(`/proyectos/${encodeURIComponent(id)}/habilidades/${encodeURIComponent(habilidadId)}`),

  // Una reserva de ID permite recuperar el mismo borrador después de un fallo.
  saveWorkflow: async ({ proyectoId, borradorId, datos, requisitos = [], onDraftReserved }) => {
    const id = proyectoId || borradorId || crypto.randomUUID()
    if (!proyectoId && !borradorId) onDraftReserved?.(id)
    let existente
    if (!proyectoId) {
      try {
        existente = (await proyectosService.get(id)).data?.datos
      } catch (fallo) {
        if (fallo.response?.status !== 404) throw fallo
        try {
          existente = (await proyectosService.create({
            ...datos, proyectoId: id, estado: 'BORRADOR',
          })).data?.datos
        } catch (error) {
          if (error.response?.status !== 409) throw error
          existente = (await proyectosService.get(id)).data?.datos
        }
      }
    } else {
      existente = (await proyectosService.get(id)).data?.datos
    }
    if (!existente) throw new Error('No se pudo recuperar el borrador. No se intentará crear otro.')
    if (!proyectoEditable(existente)) throw new Error('Los proyectos completados o cancelados no pueden modificarse.')
    if (!estadosPermitidos(existente.estado).includes(datos.estado)) {
      throw new Error('Transición de estado no permitida para este proyecto.')
    }
    if (!proyectoId && existente.creadoPor && datos.creadoPor && existente.creadoPor !== datos.creadoPor) {
      throw new Error('El borrador recuperado pertenece a otro usuario.')
    }
    const deseados = new Map(requisitos.map(item => [item.habilidadId, item]))
    if ((existente.estado === 'ACTIVO' || datos.estado === 'ACTIVO') && !deseados.size) {
      throw new Error('Un proyecto activo debe tener al menos una habilidad requerida.')
    }
    await proyectosService.update(id, {
      nombre: datos.nombre, descripcion: datos.descripcion,
      liderId: datos.liderId, horasRequeridas: datos.horasRequeridas,
    })
    const anteriores = extractItems((await proyectosService.listRequirements(id)).data)
    const porId = new Map(anteriores.map(item => [item.habilidadId, item]))
    for (const requisito of deseados.values()) {
      const contenido = {
        habilidadId: requisito.habilidadId,
        nivelMinimo: requisito.nivelMinimo || 'JUNIOR',
        esObligatoria: requisito.esObligatoria !== false,
        ...(requisito.peso !== undefined ? { peso: Number(requisito.peso) } : {}),
      }
      const previo = porId.get(requisito.habilidadId)
      try {
        if (!previo) await proyectosService.addRequirement(id, contenido)
        else if (previo.nivelMinimo !== contenido.nivelMinimo ||
          previo.esObligatoria !== contenido.esObligatoria ||
          (contenido.peso !== undefined && previo.peso !== contenido.peso)) {
          await proyectosService.updateRequirement(id, requisito.habilidadId, contenido)
        }
      } catch (fallo) {
        throw new Error(`No se pudo guardar la habilidad "${requisito.nombre || requisito.habilidadId}": ${fallo.response?.data?.error?.mensaje || fallo.response?.data?.mensaje || fallo.message}`)
      }
    }
    for (const previo of anteriores) {
      if (!deseados.has(previo.habilidadId)) {
        if (!puedeQuitarRequisito(existente.estado, anteriores.length)) {
          throw new Error('No se puede quitar la última habilidad de un proyecto activo.')
        }
        try {
          await proyectosService.removeRequirement(id, previo.habilidadId)
        } catch (fallo) {
          throw new Error(`No se pudo retirar la habilidad "${previo.nombre || previo.habilidadId}": ${fallo.response?.data?.error?.mensaje || fallo.message}`)
        }
      }
    }
    if (datos.estado !== existente.estado) {
      const confirmacion = await proyectosService.changeStatus(id, { estado: datos.estado })
      if (confirmacion.data?.datos?.estado !== datos.estado) {
        throw new Error('El servidor no confirmó el estado solicitado; el proyecto no se marcará como publicado.')
      }
    }
    return { proyectoId: id, estado: datos.estado }
  },
}
