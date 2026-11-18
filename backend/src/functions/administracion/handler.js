const { exito, error } = require('../../utils/responses');
const { ErrorApp, CODIGOS } = require('../../utils/errors');
const repositorio = require('../../repositories/administracion.repository');
const auditoriaRepo = require('../../repositories/auditoria.repository');
const { crearDespachador } = require('../../utils/lambda-dispatcher');
const { PERMISOS, valoresIniciales, politicaVigente } = require('../../config/permisos-operativos');

const ROLES_BASE = new Map([
  ['EMPLEADO', 'Empleado'],
  ['RRHH', 'RRHH'],
  ['LIDER_PROYECTO', 'Líder de proyecto'],
  ['ADMINISTRADOR', 'Administrador'],
]);

// Solo se administran parámetros que tienen consumidores reales en la aplicación.
// Los valores de referencia se muestran para explicar las reglas fijas.
const PARAMETROS_BASE = [
  { id: 'nombre-organizacion', nombre: 'Nombre de la organización', descripcion: 'Nombre mostrado en el inicio de sesión y la navegación', valor: 'Internal Marketplace', tipo: 'texto', esReferencia: false },
  { id: 'limite-dedicacion', nombre: 'Límite de dedicación por colaborador', descripcion: 'Límite fijo de asignaciones activas', valor: '100', tipo: 'porcentaje', esReferencia: true },
  { id: 'dias-actividad-dashboard', nombre: 'Días de actividad del dashboard', descripcion: 'Período consultado para actividad reciente del administrador (1 a 90 días)', valor: '30', tipo: 'numero', esReferencia: false },
  { id: 'registros-pagina-dashboard', nombre: 'Registros por página del dashboard', descripcion: 'Usuarios y actividades por página (3 a 15)', valor: '5', tipo: 'numero', esReferencia: false },
];
const CATALOGOS_BASE = [
  { id: 'niveles-habilidad', nombre: 'Niveles de habilidad', descripcion: 'Niveles establecidos por el backend', valores: ['Junior', 'Mid', 'Senior'], esReferencia: true },
  { id: 'estados-proyecto', nombre: 'Estados de proyecto', descripcion: 'Estados establecidos por el backend', valores: ['Borrador', 'Activo', 'Pausado', 'Completado', 'Cancelado'], esReferencia: true },
];

function configuracionEfectiva(contenido) {
  const parametrosGuardados = Array.isArray(contenido?.parametros) ? contenido.parametros : [];
  return {
    parametros: PARAMETROS_BASE.map(base => {
      const guardado = parametrosGuardados.find(item => item.id === base.id);
      if (!guardado || base.esReferencia) return { ...base };
      const valor = String(guardado.valor ?? '');
      if (base.id === 'nombre-organizacion' && (!valor.trim() || valor.length > 70)) return { ...base };
      if (base.id === 'dias-actividad-dashboard' && (!Number.isInteger(Number(valor)) || Number(valor) < 1 || Number(valor) > 90)) return { ...base };
      if (base.id === 'registros-pagina-dashboard' && (!Number.isInteger(Number(valor)) || Number(valor) < 3 || Number(valor) > 15)) return { ...base };
      return { ...base, valor };
    }),
    catalogos: CATALOGOS_BASE.map(base => ({ ...base, valores: [...base.valores] })),
  };
}

function invalido(mensaje) {
  throw new ErrorApp(mensaje, 400, CODIGOS.VALIDACION);
}

function lista(valor, etiqueta) {
  if (!Array.isArray(valor) || valor.length > 100) invalido(etiqueta + ' debe ser una lista de hasta 100 elementos');
  const vistos = new Set();
  for (const item of valor) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalido('Elemento inválido en ' + etiqueta);
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id)) invalido('Identificador inválido en ' + etiqueta);
    if (typeof item.nombre !== 'string' || !item.nombre.trim() || item.nombre.length > 90 ||
      typeof item.descripcion !== 'string' || !item.descripcion.trim() || item.descripcion.length > 350) {
      invalido('Nombre o descripción inválidos en ' + etiqueta);
    }
    if (vistos.has(item.id)) invalido('Identificadores repetidos en ' + etiqueta);
    vistos.add(item.id);
  }
  return valor;
}

function validarConfiguracion(datos) {
  const parametros = lista(datos.parametros, 'parámetros').map(item => {
    const base = PARAMETROS_BASE.find(definicion => definicion.id === item.id);
    if (!base) invalido('Parámetro sin funcionalidad asociada en el sistema');
    if (item.tipo !== base.tipo) invalido('No se puede cambiar el tipo de un parámetro del sistema');
    if (typeof item.valor !== 'string' || item.valor.length > 500 ||
      !['texto', 'porcentaje', 'numero'].includes(item.tipo)) invalido('Valor o tipo de parámetro inválido');
    if (item.tipo === 'porcentaje' && (!Number.isFinite(Number(item.valor)) ||
      Number(item.valor) < 1 || Number(item.valor) > 100)) invalido('Porcentaje inválido');
    if (item.tipo === 'numero' && (!Number.isFinite(Number(item.valor)) || !Number.isInteger(Number(item.valor)))) {
      invalido('El parámetro numérico debe ser un número entero');
    }
    if (item.id === 'dias-actividad-dashboard' &&
      (item.tipo !== 'numero' || Number(item.valor) < 1 || Number(item.valor) > 90)) {
      invalido('Los días de actividad deben estar entre 1 y 90');
    }
    if (item.id === 'registros-pagina-dashboard' &&
      (item.tipo !== 'numero' || Number(item.valor) < 3 || Number(item.valor) > 15)) {
      invalido('Los registros por página deben estar entre 3 y 15');
    }
    if (item.id === 'limite-dedicacion' && item.valor !== '100') {
      invalido('El límite de dedicación es una regla fija del backend: 100 %');
    }
    if (item.id === 'nombre-organizacion' &&
      (item.tipo !== 'texto' || !item.valor.trim() || item.valor.trim().length > 70)) {
      invalido('El nombre de la organización debe contener entre 1 y 70 caracteres');
    }
    return { ...base, valor: item.valor };
  });
  if (parametros.length !== PARAMETROS_BASE.length) {
    invalido('Todos los parámetros oficiales del sistema son obligatorios');
  }
  const catalogos = lista(datos.catalogos, 'catálogos').map(item => {
    const base = CATALOGOS_BASE.find(definicion => definicion.id === item.id);
    if (!base) invalido('Catálogo sin funcionalidad asociada; administre habilidades y cargos en RRHH');
    if (!Array.isArray(item.valores) || !item.valores.length || item.valores.length > 50 ||
      item.valores.some(valor => typeof valor !== 'string' || !valor.trim() || valor.length > 100)) {
      invalido('Valores de catálogo inválidos');
    }
    const valores = item.valores.map(valor => valor.trim());
    if (new Set(valores.map(valor => valor.toLowerCase())).size !== valores.length) invalido('El catálogo tiene valores repetidos');
    if (item.id === 'niveles-habilidad' && JSON.stringify(valores) !== JSON.stringify(['Junior', 'Mid', 'Senior'])) {
      invalido('Los niveles de habilidad del backend son fijos');
    }
    if (item.id === 'estados-proyecto' && JSON.stringify(valores) !==
      JSON.stringify(['Borrador', 'Activo', 'Pausado', 'Completado', 'Cancelado'])) {
      invalido('Los estados de proyecto del backend son fijos');
    }
    return { ...base, valores: [...base.valores] };
  });
  if (catalogos.length !== CATALOGOS_BASE.length) {
    invalido('Los catálogos oficiales del sistema son obligatorios');
  }
  return { parametros, catalogos };
}

function validarRolesPermisos(datos) {
  const roles = lista(datos.roles, 'roles').map(item => {
    if (!ROLES_BASE.has(item.id)) invalido('Solo se admiten los cuatro roles oficiales del sistema');
    if (item.nombre !== ROLES_BASE.get(item.id)) {
      invalido('No se puede modificar el nombre de un rol del sistema');
    }
    return {
      id: item.id, nombre: item.nombre.trim(), descripcion: item.descripcion.trim(),
      sistema: ROLES_BASE.has(item.id),
    };
  });
  const idsRoles = new Set(roles.map(item => item.id));
  for (const id of ROLES_BASE.keys()) {
    if (!idsRoles.has(id)) invalido('No se puede eliminar un rol del sistema');
  }
  const enviados = lista(datos.permisos, 'permisos');
  if (enviados.some(item => Array.isArray(item.roles) && item.roles.some(id => !idsRoles.has(id)))) {
    invalido('El permiso contiene roles desconocidos');
  }
  const permisosSolicitados = enviados.length ? enviados : valoresIniciales().permisos;
  if (permisosSolicitados.length !== PERMISOS.length) invalido('Debe incluirse el catálogo completo de permisos operativos');
  const permisos = permisosSolicitados.map(item => {
    const definicion = PERMISOS.find(permiso => permiso.id === item.id);
    if (!definicion) invalido('Permiso operativo desconocido');
    if (!Array.isArray(item.roles) || item.roles.some(id => !idsRoles.has(id))) {
      invalido('El permiso contiene roles desconocidos');
    }
    if (item.roles.some(id => !definicion.permitidos.includes(id))) {
      invalido('No se pueden conceder permisos superiores al rol del usuario');
    }
    if (definicion.permitidos.includes('ADMINISTRADOR') && !item.roles.includes('ADMINISTRADOR')) {
      invalido('No se pueden revocar los permisos esenciales del administrador');
    }
    return { id: definicion.id, nombre: definicion.nombre, descripcion: definicion.descripcion,
      roles: [...new Set(item.roles)], rolesPermitidos: [...definicion.permitidos], sistema: true };
  });
  if (new Set(permisos.map(item => item.id)).size !== PERMISOS.length) invalido('Permisos operativos repetidos');
  return { version: 2, roles, permisos };
}

async function consultar(event, area) {
  try {
    const datos = await repositorio.obtener(area);
    return exito(area === 'roles-permisos' ? politicaVigente(datos) : configuracionEfectiva(datos));
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function guardar(event, area) {
  try {
    const datos = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) invalido('Se requiere un objeto JSON');
    const contenido = area === 'configuracion' ? validarConfiguracion(datos) : validarRolesPermisos(datos);
    return exito(await repositorio.guardar(area, contenido, event.usuarioAutenticado.usuarioId));
  } catch (err) {
    return error(err instanceof SyntaxError ? 'JSON inválido' : err.message,
      err instanceof SyntaxError ? 400 : err.codigo || 500,
      err instanceof SyntaxError ? CODIGOS.VALIDACION : err.codigoError);
  }
}

async function consultarMarcaPublica() {
  try {
    const configuracion = await repositorio.obtener('configuracion');
    const nombre = configuracionEfectiva(configuracion).parametros.find(item => item.id === 'nombre-organizacion').valor;
    return exito({ nombreOrganizacion: typeof nombre === 'string' && nombre.trim() && nombre.length <= 70
      ? nombre.trim() : 'Internal Marketplace' });
  } catch (err) {
    // No se publica configuración interna ni información técnica en este endpoint público.
    console.error('No se pudo consultar el nombre público de la organización', { tipo: err.name });
    return exito({ nombreOrganizacion: 'Internal Marketplace' });
  }
}

function validarFecha(valor, campo) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
    Number.isNaN(Date.parse(valor + 'T00:00:00Z')) ||
    new Date(valor + 'T00:00:00Z').toISOString().slice(0, 10) !== valor) {
    invalido('Fecha inválida en ' + campo + ' (YYYY-MM-DD)');
  }
  return valor;
}

async function consultarAuditoria(event) {
  try {
    const query = event.queryStringParameters || {};
    const hoy = new Date().toISOString().slice(0, 10);
    const desde = validarFecha(query.desde || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), 'desde');
    const hasta = validarFecha(query.hasta || hoy, 'hasta');
    if (desde > hasta) invalido('La fecha desde no puede superar la fecha hasta');
    const limite = query.limite === undefined ? 100 : Number(query.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) invalido('limite debe estar entre 1 y 100');
    let cursor = null;
    if (query.cursor !== undefined) {
      if (typeof query.cursor !== 'string' || query.cursor.length > 2048 ||
        !/^[A-Za-z0-9_-]+$/.test(query.cursor)) invalido('Cursor inválido');
      try {
        cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
        if (!cursor || typeof cursor.auditoriaId !== 'string' ||
          typeof cursor.fechaId !== 'string' || cursor.tipoRegistro !== 'EVENTO') invalido('Cursor inválido');
      } catch { invalido('Cursor inválido'); }
    }
    const resultado = await auditoriaRepo.listar({ desde, hasta, limite, cursor });
    return exito({
      items: resultado.items,
      nextCursor: resultado.lastKey ? Buffer.from(JSON.stringify(resultado.lastKey)).toString('base64url') : null,
    });
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

const handler = crearDespachador({
  'GET /api/v1/branding': consultarMarcaPublica,
  'GET /api/v1/administracion/configuracion': event => consultar(event, 'configuracion'),
  'GET /api/v1/administracion/auditoria': consultarAuditoria,
  'PUT /api/v1/administracion/configuracion': event => guardar(event, 'configuracion'),
  'GET /api/v1/administracion/roles-permisos': event => consultar(event, 'roles-permisos'),
  'PUT /api/v1/administracion/roles-permisos': event => guardar(event, 'roles-permisos'),
});

module.exports = { consultar, guardar, consultarAuditoria, consultarMarcaPublica, validarConfiguracion, configuracionEfectiva, validarRolesPermisos, handler };
