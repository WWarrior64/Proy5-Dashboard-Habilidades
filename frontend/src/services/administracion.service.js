import api from './api.js'

export const administracionService = {
  getConfiguracion: () => api.get('/administracion/configuracion'),
  saveConfiguracion: data => api.put('/administracion/configuracion', data),
  getRolesPermisos: () => api.get('/administracion/roles-permisos'),
  saveRolesPermisos: data => api.put('/administracion/roles-permisos', data),
}
