const { exito, error } = require('../../utils/responses');
const { ErrorApp, CODIGOS } = require('../../utils/errors');
const repositorio = require('../../repositories/administracion.repository');
const auditoriaRepo = require('../../repositories/auditoria.repository');
const { crearDespachador } = require('../../utils/lambda-dispatcher');

const ROLES_BASE = new Map([
  ['EMPLEADO', 'Empleado'],
  ['RRHH', 'RRHH'],
  ['LIDER_PROYECTO', 'Líder de proyecto'],
  ['ADMINISTRADOR', 'Administrador'],
]);

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
    if (typeof item.valor !== 'string' || item.valor.length > 500 ||
      !['texto', 'porcentaje', 'numero'].includes(item.tipo)) invalido('Valor o tipo de parámetro inválido');
    if (item.tipo === 'porcentaje' && (!Number.isFinite(Number(item.valor)) ||
      Number(item.valor) < 1 || Number(item.valor) > 100)) invalido('Porcentaje inválido');
    if (item.id === 'limite-dedicacion' && item.valor !== '100') {
      invalido('El límite de dedicación es una regla fija del backend: 100 %');
    }
    return { id: item.id, nombre: item.nombre.trim(), descripcion: item.descripcion.trim(),
      valor: item.valor, tipo: item.tipo, esReferencia: ['limite-dedicacion', 'nombre-organizacion'].includes(item.id) };
  });
  if (!parametros.some(item => item.id === 'limite-dedicacion' && item.valor === '100')) {
    invalido('El límite de dedicación del sistema es obligatorio');
  }
  const catalogos = lista(datos.catalogos, 'catálogos').map(item => {
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
    return { id: item.id, nombre: item.nombre.trim(), descripcion: item.descripcion.trim(),
      valores, esReferencia: ['niveles-habilidad', 'estados-proyecto'].includes(item.id) };
  });
  if (!['niveles-habilidad', 'estados-proyecto'].every(id => catalogos.some(item => item.id === id))) {
    invalido('Los catálogos del sistema son obligatorios');
  }
  return { parametros, catalogos };
}

function validarRolesPermisos(datos) {
  const roles = lista(datos.roles, 'roles').map(item => {
    if (ROLES_BASE.has(item.id) && item.nombre !== ROLES_BASE.get(item.id)) {
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
  const permisos = lista(datos.permisos, 'permisos').map(item => {
    if (!Array.isArray(item.roles) || item.roles.some(id => !idsRoles.has(id))) {
      invalido('El permiso contiene roles desconocidos');
    }
    return { id: item.id, nombre: item.nombre.trim(), descripcion: item.descripcion.trim(),
      roles: [...new Set(item.roles)] };
  });
  return { roles, permisos };
}

async function consultar(event, area) {
  try {
    const datos = await repositorio.obtener(area);
    return exito(datos);
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
  'GET /api/v1/administracion/configuracion': event => consultar(event, 'configuracion'),
  'GET /api/v1/administracion/auditoria': consultarAuditoria,
  'PUT /api/v1/administracion/configuracion': event => guardar(event, 'configuracion'),
  'GET /api/v1/administracion/roles-permisos': event => consultar(event, 'roles-permisos'),
  'PUT /api/v1/administracion/roles-permisos': event => guardar(event, 'roles-permisos'),
});

module.exports = { consultar, guardar, consultarAuditoria, validarConfiguracion, validarRolesPermisos, handler };
