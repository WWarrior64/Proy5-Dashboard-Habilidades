export const ROLES = {
  EMPLEADO: 'EMPLEADO',
  RRHH: 'RRHH',
  LIDER_PROYECTO: 'LIDER_PROYECTO',
  ADMINISTRADOR: 'ADMINISTRADOR',
}

export const SKILL_LEVELS = [
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'MID', label: 'Mid' },
  { value: 'SENIOR', label: 'Senior' },
]

export const DEDICACION_OPTIONS = [25, 50, 75, 100]

export const PROJECT_STATUS = {
  ACTIVO: 'ACTIVO',
  BORRADOR: 'BORRADOR',
  PAUSADO: 'PAUSADO',
  CANCELADO: 'CANCELADO',
  COMPLETADO: 'COMPLETADO',
}

export const APPLICATION_STATUS = {
  PENDIENTE: 'PENDIENTE',
  ACEPTADA: 'ACEPTADA',
  RECHAZADA: 'RECHAZADA',
  RETIRADA: 'RETIRADA',
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
  CARGOS: '/cargos',
  BUSQUEDA: '/busqueda',
  ASIGNACIONES: '/asignaciones',
  POSTULACIONES: '/postulaciones',
  USUARIOS: '/usuarios',
  PERFIL: '/perfil',
}

export const COLLABORATOR_STATUS = {
  ACTIVO: 'ACTIVO',
  INACTIVO: 'INACTIVO',
}

export const PERMISSIONS = {
  // Usuarios
  CONSULTAR_USUARIOS: 'consultar_usuarios',
  GESTIONAR_USUARIOS: 'gestionar_usuarios',
  // Colaboradores
  CONSULTAR_COLABORADORES: 'consultar_colaboradores',
  REGISTRAR_COLABORADOR: 'registrar_colaborador',
  MODIFICAR_COLABORADOR: 'modificar_colaborador',
  DAR_BAJA_COLABORADOR: 'dar_baja_colaborador',
  // Cargos
  CONSULTAR_CARGOS: 'consultar_cargos',
  GESTIONAR_CARGOS: 'gestionar_cargos',
  // Habilidades
  CONSULTAR_HABILIDADES: 'consultar_habilidades',
  GESTIONAR_HABILIDADES: 'gestionar_habilidades',
  // ColaboradorHabilidad
  GESTIONAR_HABILIDADES_COLABORADOR: 'gestionar_habilidades_colaborador',
  // Búsqueda
  BUSCAR_CANDIDATOS: 'buscar_candidatos',
  // Proyectos
  CONSULTAR_PROYECTOS: 'consultar_proyectos',
  GESTIONAR_PROYECTOS: 'gestionar_proyectos',
  // Asignaciones
  CONSULTAR_ASIGNACIONES: 'consultar_asignaciones',
  GESTIONAR_ASIGNACIONES: 'gestionar_asignaciones',
  // Postulaciones
  CONSULTAR_POSTULACIONES: 'consultar_postulaciones',
  GESTIONAR_POSTULACIONES: 'gestionar_postulaciones',
  // Perfil propio
  VER_PERFIL: 'ver_perfil',
  MODIFICAR_PERFIL: 'modificar_perfil',
}