const { randomUUID } = require('crypto');
const { dynamoDb, PutCommand, QueryCommand } = require('../config/dynamodb');
const { tableAuditoria } = require('../config/environment');

const ENTIDADES = {
  usuarios: ['Usuarios', 'usuario'],
  colaboradores: ['Colaboradores', 'colaborador'],
  cargos: ['Cargos', 'cargo'],
  habilidades: ['Habilidades', 'habilidad'],
  proyectos: ['Proyectos', 'proyecto'],
  postulaciones: ['Postulaciones', 'postulación'],
  asignaciones: ['Asignaciones', 'asignación'],
  administracion: ['Administración', 'configuración'],
};

function leerJson(valor) {
  try {
    return typeof valor === 'string' ? JSON.parse(valor) : valor || {};
  } catch {
    return {};
  }
}

function construirEvento(event, ruta, respuesta) {
  const [metodo, plantilla] = ruta.split(' ');
  if (metodo === 'GET') return null;
  const usuario = event.usuarioAutenticado;
  if (!usuario?.usuarioId) return null;

  const partes = plantilla.split('/').filter(Boolean).slice(2);
  const categoria = ['postulaciones', 'asignaciones', 'habilidades']
    .find(nombre => partes.includes(nombre)) || partes[0];
  const [entidad, singular] = ENTIDADES[categoria] || ['Otros', 'registro'];
  const cuerpo = leerJson(event.body);
  const datos = leerJson(respuesta.body).datos || {};
  const parametros = event.pathParameters || {};
  const esSesion = plantilla === '/api/v1/usuarios/yo/acceso';
  const recursoId = esSesion ? usuario.usuarioId : [
    parametros.asignacionId, parametros.proyectoId, parametros.colaboradorId,
    parametros.usuarioId, parametros.cargoId, parametros.habilidadId,
    cuerpo.asignacionId, cuerpo.proyectoId, cuerpo.colaboradorId,
    datos.asignacionId, datos.proyectoId, datos.colaboradorId, datos.usuarioId,
    datos.cargoId, datos.habilidadId,
  ].find(valor => typeof valor === 'string' && valor.length < 160);

  let tipo = metodo === 'POST' ? 'CREACION' : 'ACTUALIZACION';
  if (esSesion) tipo = 'INICIO_SESION';
  else if (metodo === 'DELETE' || plantilla.endsWith('/estado') ||
    plantilla.endsWith('/retirar') || ['estado', 'activo'].some(clave =>
      Object.prototype.hasOwnProperty.call(cuerpo, clave))) tipo = 'CAMBIO_ESTADO';

  const articulo = ['asignación', 'postulación', 'habilidad', 'configuración'].includes(singular) ? 'una' : 'un';
  let accion;
  if (esSesion) accion = 'inició sesión';
  else if (metodo === 'DELETE') {
    if (categoria === 'colaboradores') accion = 'dio de baja a un colaborador';
    else if (categoria === 'asignaciones') accion = 'desvinculó una asignación';
    else if (categoria === 'proyectos') accion = 'canceló un proyecto';
    else if (categoria === 'habilidades') accion = 'quitó una habilidad vinculada';
    else accion = 'retiró un registro de ' + entidad.toLowerCase();
  } else if (tipo === 'CAMBIO_ESTADO') accion = 'cambió el estado de ' + articulo + ' ' + singular;
  else if (tipo === 'CREACION') accion = 'registró ' + articulo + ' ' + singular;
  else accion = 'actualizó ' + articulo + ' ' + singular;

  const nombreRecurso = [cuerpo.nombre, datos.nombre].find(valor =>
    typeof valor === 'string' && valor.length <= 120) || null;
  const descripcion = esSesion ? 'Acceso autenticado correctamente mediante Cognito.' :
    nombreRecurso ? 'Registro: ' + nombreRecurso :
      'Operación realizada sobre ' + entidad.toLowerCase() + '.';
  const detalle = [
    recursoId ? 'ID del recurso: ' + recursoId : null,
    typeof cuerpo.estado === 'string' && cuerpo.estado.length <= 30
      ? 'Estado solicitado: ' + cuerpo.estado : null,
    typeof cuerpo.activo === 'boolean' ? 'Activo: ' + (cuerpo.activo ? 'Sí' : 'No') : null,
    'Método: ' + metodo,
  ].filter(Boolean).join(' · ');

  return {
    usuarioId: usuario.usuarioId,
    usuario: usuario.nombre || usuario.nombreCompleto || usuario.usuarioId,
    entidad, tipo, accion, descripcion, detalle, recursoId: recursoId || null,
    ruta: plantilla, metodo,
  };
}

async function registrarDesdeSolicitud(event, ruta, respuesta) {
  const evento = construirEvento(event, ruta, respuesta);
  if (!evento) return null;
  const fecha = new Date().toISOString();
  const auditoriaId = randomUUID();
  const item = {
    auditoriaId,
    tipoRegistro: 'EVENTO',
    fechaId: fecha + '#' + auditoriaId,
    fecha,
    ...evento,
  };
  await dynamoDb.send(new PutCommand({
    TableName: tableAuditoria,
    Item: item,
    ConditionExpression: 'attribute_not_exists(auditoriaId)',
  }));
  return item;
}

async function listar({ desde, hasta, limite = 100, cursor } = {}) {
  // El Salvador mantiene UTC-6. Se incluyen jornadas locales completas,
  // incluso los eventos posteriores a las 18:00 (00:00 UTC del día siguiente).
  const fechaInicio = new Date(desde + 'T06:00:00.000Z');
  const fechaFinal = new Date(hasta + 'T06:00:00.000Z');
  fechaFinal.setTime(fechaFinal.getTime() + 86400000 - 1);
  const resultado = await dynamoDb.send(new QueryCommand({
    TableName: tableAuditoria,
    IndexName: 'GSI1',
    KeyConditionExpression: '#tipo = :tipo AND #orden BETWEEN :desde AND :hasta',
    ExpressionAttributeNames: { '#tipo': 'tipoRegistro', '#orden': 'fechaId' },
    ExpressionAttributeValues: {
      ':tipo': 'EVENTO',
      ':desde': fechaInicio.toISOString() + '#',
      ':hasta': fechaFinal.toISOString() + '#~',
    },
    ScanIndexForward: false,
    Limit: limite,
    ...(cursor && { ExclusiveStartKey: cursor }),
  }));
  return { items: resultado.Items || [], lastKey: resultado.LastEvaluatedKey || null };
}

module.exports = { construirEvento, registrarDesdeSolicitud, listar };
