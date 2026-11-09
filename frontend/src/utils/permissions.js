import { ROLES, PERMISSIONS } from './constants.js'

/**
 * Mapa de permisos por rol. Cada rol tiene un conjunto de permisos específicos.
 * Estos permisos deben coincidir con las políticas de autorización del backend.
 */
export const ROLE_PERMISSIONS = {
  [ROLES.EMPLEADO]: [
    PERMISSIONS.VER_PERFIL,
    PERMISSIONS.MODIFICAR_PERFIL,
    PERMISSIONS.CONSULTAR_COLABORADORES,
    PERMISSIONS.BUSCAR_CANDIDATOS,
  ],
  [ROLES.RRHH]: [
    PERMISSIONS.VER_PERFIL,
    PERMISSIONS.MODIFICAR_PERFIL,
    PERMISSIONS.CONSULTAR_USUARIOS,
    PERMISSIONS.GESTIONAR_USUARIOS,
    PERMISSIONS.CONSULTAR_COLABORADORES,
    PERMISSIONS.REGISTRAR_COLABORADOR,
    PERMISSIONS.MODIFICAR_COLABORADOR,
    PERMISSIONS.DAR_BAJA_COLABORADOR,
    PERMISSIONS.GESTIONAR_HABILIDADES_COLABORADOR,
    PERMISSIONS.CONSULTAR_CARGOS,
    PERMISSIONS.GESTIONAR_CARGOS,
    PERMISSIONS.CONSULTAR_HABILIDADES,
    PERMISSIONS.GESTIONAR_HABILIDADES,
    PERMISSIONS.BUSCAR_CANDIDATOS,
    PERMISSIONS.CONSULTAR_PROYECTOS,
    PERMISSIONS.CONSULTAR_ASIGNACIONES,
    PERMISSIONS.CONSULTAR_POSTULACIONES,
    PERMISSIONS.GESTIONAR_POSTULACIONES,
  ],
  [ROLES.LIDER_PROYECTO]: [
    PERMISSIONS.VER_PERFIL,
    PERMISSIONS.MODIFICAR_PERFIL,
    PERMISSIONS.CONSULTAR_COLABORADORES,
    PERMISSIONS.CONSULTAR_CARGOS,
    PERMISSIONS.CONSULTAR_HABILIDADES,
    PERMISSIONS.BUSCAR_CANDIDATOS,
    PERMISSIONS.CONSULTAR_PROYECTOS,
    PERMISSIONS.GESTIONAR_PROYECTOS,
    PERMISSIONS.CONSULTAR_ASIGNACIONES,
    PERMISSIONS.GESTIONAR_ASIGNACIONES,
    PERMISSIONS.CONSULTAR_POSTULACIONES,
    PERMISSIONS.GESTIONAR_POSTULACIONES,
  ],
  [ROLES.ADMINISTRADOR]: [
    PERMISSIONS.VER_PERFIL,
    PERMISSIONS.MODIFICAR_PERFIL,
    PERMISSIONS.CONSULTAR_USUARIOS,
    PERMISSIONS.GESTIONAR_USUARIOS,
    PERMISSIONS.CONSULTAR_COLABORADORES,
    PERMISSIONS.REGISTRAR_COLABORADOR,
    PERMISSIONS.MODIFICAR_COLABORADOR,
    PERMISSIONS.DAR_BAJA_COLABORADOR,
    PERMISSIONS.GESTIONAR_HABILIDADES_COLABORADOR,
    PERMISSIONS.CONSULTAR_CARGOS,
    PERMISSIONS.GESTIONAR_CARGOS,
    PERMISSIONS.CONSULTAR_HABILIDADES,
    PERMISSIONS.GESTIONAR_HABILIDADES,
    PERMISSIONS.BUSCAR_CANDIDATOS,
    PERMISSIONS.CONSULTAR_PROYECTOS,
    PERMISSIONS.GESTIONAR_PROYECTOS,
    PERMISSIONS.CONSULTAR_ASIGNACIONES,
    PERMISSIONS.GESTIONAR_ASIGNACIONES,
    PERMISSIONS.CONSULTAR_POSTULACIONES,
    PERMISSIONS.GESTIONAR_POSTULACIONES,
  ],
}

/**
 * Mapa de rutas a permisos requeridos para acceder a ellas.
 */
export const ROUTE_PERMISSION_MAP = {
  '/perfil': PERMISSIONS.VER_PERFIL,
  '/usuarios': PERMISSIONS.CONSULTAR_USUARIOS,
  '/colaboradores': PERMISSIONS.CONSULTAR_COLABORADORES,
  '/cargos': PERMISSIONS.CONSULTAR_CARGOS,
  '/habilidades': PERMISSIONS.CONSULTAR_HABILIDADES,
  '/busqueda': PERMISSIONS.BUSCAR_CANDIDATOS,
  '/proyectos': PERMISSIONS.CONSULTAR_PROYECTOS,
  '/asignaciones': PERMISSIONS.CONSULTAR_ASIGNACIONES,
  '/postulaciones': PERMISSIONS.CONSULTAR_POSTULACIONES,
  '/dashboards/administrador': PERMISSIONS.GESTIONAR_USUARIOS,
  '/dashboards/rrhh': PERMISSIONS.GESTIONAR_USUARIOS,
  '/dashboards/lider': PERMISSIONS.BUSCAR_CANDIDATOS,
  '/dashboards/empleado': PERMISSIONS.VER_PERFIL,
}

/**
 * Verifica si un rol tiene un permiso específico.
 * @param {string} role - Rol del usuario
 * @param {string} permission - Permiso a verificar
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Verifica si un usuario puede acceder a una ruta específica.
 * @param {string} role - Rol del usuario
 * @param {string} path - Ruta a verificar
 * @returns {boolean}
 */
export function canAccessRoute(role, path) {
  if (!role || !path) return false
  const requiredPermission = ROUTE_PERMISSION_MAP[path]
  if (!requiredPermission) return true
  return hasPermission(role, requiredPermission)
}

/**
 * Obtiene todos los permisos de un rol.
 * @param {string} role
 * @returns {string[]}
 */
export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Verifica si un rol tiene al menos uno de los permisos dados.
 * @param {string} role
 * @param {string[]} permissions
 * @returns {boolean}
 */
export function hasAnyPermission(role, permissions) {
  if (!role || !permissions || permissions.length === 0) return false
  return permissions.some((p) => hasPermission(role, p))
}

/**
 * Verifica si un rol tiene todos los permisos dados.
 * @param {string} role
 * @param {string[]} permissions
 * @returns {boolean}
 */
export function hasAllPermissions(role, permissions) {
  if (!role || !permissions || permissions.length === 0) return false
  return permissions.every((p) => hasPermission(role, p))
}