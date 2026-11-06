const { ErrorApp, CODIGOS } = require('../utils/errors');
const { autorizar } = require('./authorization');
const { dynamoDb, GetCommand } = require('../config/dynamodb');
const env = require('../config/environment');
const TODOS = ['EMPLEADO', 'RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'];
function denegar() { throw new ErrorApp('Permisos insuficientes', 403, CODIGOS.PROHIBIDO); }
async function leer(table, key) {
  const result = await dynamoDb.send(new GetCommand({ TableName: table, Key: key, ConsistentRead: true }));
  if (!result.Item) throw new ErrorApp('Recurso no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  return result.Item;
}
async function proteger(event, route) {
  const usuario = event.usuarioAutenticado;
  const allowed = await autorizar(TODOS)(event, async () => true);
  if (allowed !== true) denegar();
  const admin = usuario.rol === 'ADMINISTRADOR';
  const gestor = admin || usuario.rol === 'RRHH';
  const lider = usuario.rol === 'LIDER_PROYECTO';
  const [method, path] = route.split(' ');
  const write = method !== 'GET';
  let body = {};
  if (event.body) {
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; }
    catch { throw new ErrorApp('JSON inválido', 400, CODIGOS.VALIDACION); }
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new ErrorApp('Objeto JSON requerido', 400, CODIGOS.VALIDACION);
  }
  const params = event.pathParameters || {};
  let proyectoId = params.proyectoId || body.proyectoId;
  let colaboradorId = params.colaboradorId || body.colaboradorId;
  if (params.asignacionId) {
    const asignacion = await leer(env.tableAsignaciones, { asignacionId: params.asignacionId });
    proyectoId = asignacion.proyectoId;
    colaboradorId = asignacion.colaboradorId;
  }
  async function propio() {
    if (!colaboradorId) denegar();
    const colaborador = await leer(env.tableColaboradores, { colaboradorId });
    if (colaborador.usuarioId !== usuario.usuarioId) denegar();
  }
  async function liderPropio() {
    if (!lider || !proyectoId) denegar();
    const proyecto = await leer(env.tableProyectos, { proyectoId });
    if (proyecto.liderId !== usuario.usuarioId) denegar();
  }
  if (path.startsWith('/api/v1/usuarios')) {
    if (path.endsWith('/rol') || path.endsWith('/estado') || method === 'POST') {
      if (!admin) denegar();
    } else if (path.endsWith('/yo')) {
      // Perfil autenticado.
    } else if (params.usuarioId) {
      if (!gestor && params.usuarioId !== usuario.usuarioId) denegar();
      if (write && ['rol', 'estado', 'cognitoSub', 'usuarioId'].some((key) => key in body)) denegar();
    } else if (!gestor) denegar();
  } else if (path.includes('/postulaciones')) {
    if (method === 'POST') { if (!gestor) await propio(); }
    else if (write && (path.endsWith('/retirar') || body.estado === 'RETIRADA')) { if (!gestor) await propio(); }
    else if (write || (proyectoId && !colaboradorId)) { if (!gestor) await liderPropio(); }
    else if (!gestor) { if (lider && proyectoId) await liderPropio(); else await propio(); }
  } else if (path.includes('/asignaciones')) {
    if (!gestor) { if (write || lider) await liderPropio(); else await propio(); }
  } else if (path.startsWith('/api/v1/proyectos')) {
    if (write && !gestor) {
      if (method === 'POST' && !params.proyectoId) {
        if (!lider) denegar();
        body.liderId = usuario.usuarioId;
      } else { await liderPropio(); if (body.liderId && body.liderId !== usuario.usuarioId) denegar(); }
    }
  } else if (path.startsWith('/api/v1/colaboradores')) {
    if (path.includes('/habilidades')) { if (write && !gestor) await propio(); }
    else if (write && !gestor) denegar();
  } else if (path.startsWith('/api/v1/cargos') || path.startsWith('/api/v1/habilidades')) {
    if (write && !gestor) denegar();
  } else if (path.startsWith('/api/v1/dashboard') || path.startsWith('/api/v1/busqueda/colaboradores')) {
    if (!gestor && !lider) denegar();
  } else if (!path.startsWith('/api/v1/busqueda/')) denegar();
  if (write) {
    body.creadoPor = usuario.usuarioId;
    body.revisadoPor = usuario.usuarioId;
    body.actualizadoPor = usuario.usuarioId;
    event.body = JSON.stringify(body);
  }
}
module.exports = { proteger };