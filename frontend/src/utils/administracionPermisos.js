// Catálogo oficial de operaciones del sistema. Debe coincidir con
// backend/src/config/permisos-operativos.js; no son permisos inventados por la UI.
export const ROLES_OFICIALES = [
  { id: 'EMPLEADO', nombre: 'Empleado', descripcion: 'Consulta proyectos y administra sus habilidades y postulaciones', sistema: true },
  { id: 'RRHH', nombre: 'RRHH', descripcion: 'Administra colaboradores, cargos, habilidades, proyectos y asignaciones', sistema: true },
  { id: 'LIDER_PROYECTO', nombre: 'Líder de proyecto', descripcion: 'Gestiona sus proyectos, postulaciones y asignaciones', sistema: true },
  { id: 'ADMINISTRADOR', nombre: 'Administrador', descripcion: 'Administra usuarios, configuración y todos los módulos', sistema: true },
]

export const PERMISOS_OFICIALES = [
  { id: 'gestionar_usuarios', nombre: 'Gestionar usuarios', descripcion: 'Crear cuentas y cambiar sus roles o estados', rolesPermitidos: ['ADMINISTRADOR'] },
  { id: 'gestionar_colaboradores', nombre: 'Gestionar colaboradores', descripcion: 'Registrar, editar, dar de baja y reincorporar colaboradores', rolesPermitidos: ['RRHH', 'ADMINISTRADOR'] },
  { id: 'gestionar_cargos', nombre: 'Gestionar cargos', descripcion: 'Registrar, modificar, activar o desactivar cargos', rolesPermitidos: ['RRHH', 'ADMINISTRADOR'] },
  { id: 'gestionar_habilidades', nombre: 'Gestionar catálogo de habilidades', descripcion: 'Registrar y modificar habilidades del catálogo de RRHH', rolesPermitidos: ['RRHH', 'ADMINISTRADOR'] },
  { id: 'gestionar_habilidades_propias', nombre: 'Gestionar habilidades del perfil', descripcion: 'Vincular y actualizar habilidades de colaboradores autorizados', rolesPermitidos: ['EMPLEADO', 'RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'] },
  { id: 'gestionar_proyectos', nombre: 'Gestionar proyectos', descripcion: 'Crear, editar, publicar o cancelar proyectos autorizados', rolesPermitidos: ['RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'] },
  { id: 'gestionar_asignaciones', nombre: 'Gestionar asignaciones', descripcion: 'Asignar, modificar, finalizar o desvincular participantes', rolesPermitidos: ['RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'] },
  { id: 'gestionar_postulaciones', nombre: 'Gestionar postulaciones', descripcion: 'Postularse, retirar o revisar solicitudes según el rol y propiedad', rolesPermitidos: ['EMPLEADO', 'RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'] },
]

const permisosPredeterminados = () => PERMISOS_OFICIALES.map(item => ({
  ...item, roles: [...item.rolesPermitidos], sistema: true,
}))

export function resolverPoliticaAdministrativa(datos) {
  const predeterminados = { roles: ROLES_OFICIALES.map(rol => ({ ...rol })), permisos: permisosPredeterminados() }
  const idsRoles = new Set(ROLES_OFICIALES.map(rol => rol.id))
  const idsPermisos = new Set(PERMISOS_OFICIALES.map(permiso => permiso.id))
  const completa = datos?.version === 2 &&
    Array.isArray(datos.roles) && datos.roles.length === ROLES_OFICIALES.length &&
    new Set(datos.roles.map(item => item?.id)).size === idsRoles.size &&
    datos.roles.every(item => idsRoles.has(item?.id)) &&
    Array.isArray(datos.permisos) && datos.permisos.length === PERMISOS_OFICIALES.length &&
    new Set(datos.permisos.map(item => item?.id)).size === idsPermisos.size &&
    datos.permisos.every(item => idsPermisos.has(item?.id) &&
      Array.isArray(item.roles) &&
      item.roles.every(id => idsRoles.has(id) &&
        PERMISOS_OFICIALES.find(permiso => permiso.id === item.id).rolesPermitidos.includes(id)) &&
      (!PERMISOS_OFICIALES.find(permiso => permiso.id === item.id).rolesPermitidos.includes('ADMINISTRADOR') ||
        item.roles.includes('ADMINISTRADOR')))

  if (!completa) return { ...predeterminados, compatible: false }
  return {
    compatible: true,
    roles: ROLES_OFICIALES.map(base => ({
      ...base,
      descripcion: datos.roles.find(rol => rol.id === base.id)?.descripcion || base.descripcion,
    })),
    permisos: PERMISOS_OFICIALES.map(base => ({
      ...base,
      roles: [...new Set(datos.permisos.find(item => item.id === base.id).roles)],
      sistema: true,
    })),
  }
}
