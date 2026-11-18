const ROLES = Object.freeze([
  { id: 'EMPLEADO', nombre: 'Empleado', descripcion: 'Consulta proyectos, gestiona sus habilidades y postulaciones', sistema: true },
  { id: 'RRHH', nombre: 'RRHH', descripcion: 'Administra colaboradores, cargos, habilidades y proyectos', sistema: true },
  { id: 'LIDER_PROYECTO', nombre: 'Líder de proyecto', descripcion: 'Gestiona sus proyectos, asignaciones y postulaciones', sistema: true },
  { id: 'ADMINISTRADOR', nombre: 'Administrador', descripcion: 'Administra usuarios, configuración y todos los módulos', sistema: true },
]);

const PERMISOS = Object.freeze([
  { id: 'gestionar_usuarios', nombre: 'Gestionar usuarios', descripcion: 'Crear cuentas y cambiar su rol o estado', permitidos: ['ADMINISTRADOR'] },
  { id: 'gestionar_colaboradores', nombre: 'Gestionar colaboradores', descripcion: 'Registrar, editar, dar de baja y reincorporar perfiles', permitidos: ['RRHH', 'ADMINISTRADOR'] },
  { id: 'gestionar_cargos', nombre: 'Gestionar cargos', descripcion: 'Crear y actualizar los cargos profesionales', permitidos: ['RRHH', 'ADMINISTRADOR'] },
  { id: 'gestionar_habilidades', nombre: 'Gestionar catálogo de habilidades', descripcion: 'Registrar y modificar habilidades de RRHH', permitidos: ['RRHH', 'ADMINISTRADOR'] },
  { id: 'gestionar_habilidades_propias', nombre: 'Gestionar habilidades del perfil', descripcion: 'Asociar y actualizar habilidades de un colaborador según las reglas de propiedad', permitidos: ['EMPLEADO', 'RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'] },
  { id: 'gestionar_proyectos', nombre: 'Gestionar proyectos', descripcion: 'Crear, editar, publicar o cancelar proyectos autorizados', permitidos: ['RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'] },
  { id: 'gestionar_asignaciones', nombre: 'Gestionar asignaciones', descripcion: 'Asignar, modificar, finalizar o desvincular participantes', permitidos: ['RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'] },
  { id: 'gestionar_postulaciones', nombre: 'Gestionar postulaciones', descripcion: 'Postularse, retirar o revisar solicitudes según el rol y la propiedad', permitidos: ['EMPLEADO', 'RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'] },
]);

function valoresIniciales() {
  return {
    version: 2,
    roles: ROLES.map(rol => ({ ...rol })),
    permisos: PERMISOS.map(permiso => ({
      id: permiso.id, nombre: permiso.nombre, descripcion: permiso.descripcion,
      roles: [...permiso.permitidos], rolesPermitidos: [...permiso.permitidos],
      sistema: true,
    })),
  };
}

function politicaVigente(contenido) {
  // Una política parcial o heredada no debe desactivar accidentalmente
  // las funciones oficiales de RRHH ni de ningún otro rol.
  if (contenido?.version !== 2 ||
      !Array.isArray(contenido.roles) || contenido.roles.length !== ROLES.length ||
      !Array.isArray(contenido.permisos) || contenido.permisos.length !== PERMISOS.length ||
      new Set(contenido.roles.map(item => item?.id)).size !== ROLES.length ||
      !ROLES.every(rol => contenido.roles.some(item => item.id === rol.id))) {
    return valoresIniciales();
  }
  for (const definicion of PERMISOS) {
    const coincidentes = contenido.permisos.filter(item => item?.id === definicion.id);
    if (coincidentes.length !== 1 || !Array.isArray(coincidentes[0].roles) ||
        coincidentes[0].roles.some(rol => !definicion.permitidos.includes(rol)) ||
        (definicion.permitidos.includes('ADMINISTRADOR') &&
          !coincidentes[0].roles.includes('ADMINISTRADOR'))) {
      return valoresIniciales();
    }
  }
  return contenido;
}

function permisoDeRuta(metodo, ruta) {
  if (metodo === 'GET' || ruta.startsWith('/api/v1/administracion/')) return null;
  if (ruta.startsWith('/api/v1/usuarios')) {
    return ruta.includes('/yo/') || ruta.endsWith('/yo') ? null : 'gestionar_usuarios';
  }
  // Estas subrutas son operaciones distintas de la gestión del perfil.
  if (ruta.includes('/postulaciones')) return 'gestionar_postulaciones';
  if (ruta.includes('/asignaciones')) return 'gestionar_asignaciones';
  if (ruta.startsWith('/api/v1/colaboradores')) {
    return ruta.includes('/habilidades') ? 'gestionar_habilidades_propias' : 'gestionar_colaboradores';
  }
  if (ruta.startsWith('/api/v1/habilidades')) return 'gestionar_habilidades';
  if (ruta.startsWith('/api/v1/cargos')) return 'gestionar_cargos';
  if (ruta.startsWith('/api/v1/proyectos')) return 'gestionar_proyectos';
  return null;
}

function permisoEfectivo(contenido, rol, permisoId) {
  const definicion = PERMISOS.find(item => item.id === permisoId);
  if (!definicion || !definicion.permitidos.includes(rol)) return false;
  const politica = politicaVigente(contenido);
  const permiso = politica.permisos.find(item => item.id === permisoId);
  return Boolean(permiso && Array.isArray(permiso.roles) && permiso.roles.includes(rol));
}

module.exports = { ROLES, PERMISOS, valoresIniciales, politicaVigente, permisoDeRuta, permisoEfectivo };
