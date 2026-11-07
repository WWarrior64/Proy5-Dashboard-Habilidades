import { ROLES } from './constants.js'

export const ROLE_PERMISSIONS = {
  [ROLES.EMPLEADO]: ['ver_perfil', 'ver_colaboradores', 'ver_proyectos', 'postularse'],
  [ROLES.RRHH]: [
    'ver_colaboradores', 'gestionar_colaboradores', 'ver_proyectos', 'gestionar_proyectos',
    'ver_asignaciones', 'gestionar_asignaciones', 'ver_postulaciones', 'gestionar_postulaciones',
    'ver_usuarios', 'gestionar_usuarios', 'ver_perfil',
  ],
  [ROLES.LIDER_PROYECTO]: [
    'ver_proyectos', 'gestionar_proyectos', 'ver_asignaciones', 'gestionar_asignaciones',
    'ver_colaboradores', 'ver_postulaciones', 'gestionar_postulaciones', 'ver_perfil',
  ],
  [ROLES.ADMINISTRADOR]: [
    'ver_colaboradores', 'gestionar_colaboradores', 'ver_proyectos', 'gestionar_proyectos',
    'ver_asignaciones', 'gestionar_asignaciones', 'ver_postulaciones', 'gestionar_postulaciones',
    'ver_usuarios', 'gestionar_usuarios', 'ver_perfil', 'ver_habilidades', 'gestionar_habilidades',
  ],
}

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function canManage(role) {
  return [ROLES.ADMINISTRADOR, ROLES.RRHH, ROLES.LIDER_PROYECTO].includes(role)
}