import api from './api.js'

const id = (value) => encodeURIComponent(value)

export const postulacionesService = {
  create: (data) => api.post('/postulaciones', data),
  listByProject: (proyectoId) => api.get(`/proyectos/${id(proyectoId)}/postulaciones`),
  listByCollaborator: (colaboradorId) => api.get(`/colaboradores/${id(colaboradorId)}/postulaciones`),
  get: (proyectoId, colaboradorId) => api.get(`/proyectos/${id(proyectoId)}/postulaciones/${id(colaboradorId)}`),
  decide: (proyectoId, colaboradorId, data) =>
    api.patch(`/proyectos/${id(proyectoId)}/postulaciones/${id(colaboradorId)}/estado`, data),
  withdraw: (proyectoId, colaboradorId) =>
    api.patch(`/proyectos/${id(proyectoId)}/postulaciones/${id(colaboradorId)}/retirar`, {}),
}