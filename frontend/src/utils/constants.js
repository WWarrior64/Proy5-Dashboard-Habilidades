export const ROLES = {
  EMPLEADO: 'EMPLEADO',
  RRHH: 'RRHH',
  LIDER_PROYECTO: 'LIDER_PROYECTO',
  ADMINISTRADOR: 'ADMINISTRADOR',
}

export const SKILL_LEVELS = [
  { value: 'Junior', label: 'Junior' },
  { value: 'Mid', label: 'Mid' },
  { value: 'Senior', label: 'Senior' },
  { value: 'Lead', label: 'Lead' },
]

export const DEDICACION_OPTIONS = [25, 50, 75, 100]

export const PROJECT_STATUS = {
  ACTIVO: 'ACTIVO',
  PLANIFICADO: 'PLANIFICADO',
  CANCELADO: 'CANCELADO',
  COMPLETADO: 'COMPLETADO',
}

export const APPLICATION_STATUS = {
  PENDIENTE: 'PENDIENTE',
  ACEPTADA: 'ACEPTADA',
  RECHAZADA: 'RECHAZADA',
}

export const ROUTE_PATHS = {
  LOGIN: '/login',
  DASHBOARD_EMPLEADO: '/dashboards/empleado',
  DASHBOARD_RRHH: '/dashboards/rrhh',
  DASHBOARD_LIDER: '/dashboards/lider',
  DASHBOARD_ADMIN: '/dashboards/administrador',
  COLABORADORES: '/colaboradores',
  PROYECTOS: '/proyectos',
  HABILIDADES: '/habilidades',
  ASIGNACIONES: '/asignaciones',
  POSTULACIONES: '/postulaciones',
  USUARIOS: '/usuarios',
  PERFIL: '/perfil',
}