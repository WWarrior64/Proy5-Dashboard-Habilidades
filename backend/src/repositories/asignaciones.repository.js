const dedicacion = require('../services/dedicacion.service');
const { recolectarPaginas } = require('../utils/paginacion');
const {
  dynamoDb,
  GetCommand,
  QueryCommand,
} = require('../../src/config/dynamodb.js');
const {
  tableAsignaciones,
  tableColaboradores,
  tableProyectos,
  tableUsuarios,
  tablePostulaciones,
} = require('../../src/config/environment.js');
const { ErrorApp, CODIGOS } = require('../../src/utils/errors.js');
const cache = require('../../src/services/cache.service.js');

const CACHE_TTL_MS = 60000;

function claveAsignacion(asignacionId) {
  return `asignacion:${asignacionId}`;
}

function claveAsignacionesActivas() {
  return 'asignaciones:activas';
}

function claveAsignacionesColaborador(colaboradorId) {
  return `asignaciones:colaborador:${colaboradorId}`;
}

function claveAsignacionesProyecto(proyectoId) {
  return `asignaciones:proyecto:${proyectoId}`;
}

function invalidarCachéAsignacion(asignacionId, colaboradorId, proyectoId) {
  cache.eliminar(claveAsignacion(asignacionId));
  cache.eliminar(claveAsignacionesActivas());
  if (colaboradorId) cache.eliminar(claveAsignacionesColaborador(colaboradorId));
  if (proyectoId) cache.eliminar(claveAsignacionesProyecto(proyectoId));
  cache.eliminarPorPrefijo('asignaciones:');
}

function ahoraISO() {
  return new Date().toISOString();
}

async function consultarTodasPaginas(parametros) {
  return recolectarPaginas(lastKey => dynamoDb.send(new QueryCommand({
    ...parametros,
    ...(lastKey && { ExclusiveStartKey: lastKey }),
  })));
}

async function validarColaboradorActivo(colaboradorId) {
  const resultado = await dynamoDb.send(
    new GetCommand({
      TableName: tableColaboradores,
      Key: { colaboradorId },
    })
  );
  const colaborador = resultado.Item;
  if (!colaborador) {
    throw new ErrorApp('El colaborador no existe', 404, CODIGOS.NO_ENCONTRADO);
  }
  if (colaborador.estado !== 'ACTIVO') {
    throw new ErrorApp('El colaborador no está activo', 400, CODIGOS.VALIDACION);
  }
  return colaborador;
}

async function validarCuentaActiva(colaborador) {
  if (!colaborador?.usuarioId) {
    throw new ErrorApp('No se pudo comprobar la identidad del colaborador', 409, CODIGOS.CONFLICTO);
  }
  const cuenta = await dynamoDb.send(new GetCommand({
    TableName: tableUsuarios, Key: { usuarioId: colaborador.usuarioId }, ConsistentRead: true,
  }));
  if (cuenta.Item?.estado !== 'ACTIVO') {
    throw new ErrorApp('La cuenta del colaborador no existe o está inactiva', 409, CODIGOS.CONFLICTO);
  }
}

async function validarProyectoActivo(proyectoId) {
  const resultado = await dynamoDb.send(
    new GetCommand({
      TableName: tableProyectos,
      Key: { proyectoId },
    })
  );
  const proyecto = resultado.Item;
  if (!proyecto) {
    throw new ErrorApp('El proyecto no existe', 404, CODIGOS.NO_ENCONTRADO);
  }
  if (proyecto.estado !== 'ACTIVO') {
    throw new ErrorApp('El proyecto no está activo', 400, CODIGOS.VALIDACION);
  }
  return proyecto;
}

async function obtenerSumaDedicacionActiva(colaboradorId, asignacionIdExcluir) {
  const asignaciones = await consultarTodasPaginas({
    TableName: tableAsignaciones,
    IndexName: 'GSI1',
    KeyConditionExpression: '#c = :c AND begins_with(#s, :prefijo)',
    ExpressionAttributeNames: { '#c': 'colaboradorId', '#s': 'colaboradorFechaKey' },
    ExpressionAttributeValues: { ':c': colaboradorId, ':prefijo': 'ACTIVA#' },
    ProjectionExpression: 'porcentajeDedicacion, asignacionId',
  });
  return asignaciones
    .filter(item => item.asignacionId !== asignacionIdExcluir)
    .reduce((suma, item) => suma + (item.porcentajeDedicacion || 0), 0);
}

async function crearAsignacion(datos) {
  const {
    colaboradorId,
    proyectoId,
    postulacionId,
    porcentajeDedicacion,
    horasAsignadas,
    fechaInicio,
    creadoPor,
  } = datos;

  if (!colaboradorId || !proyectoId) {
    throw new ErrorApp('colaboradorId y proyectoId son obligatorios', 400, CODIGOS.VALIDACION);
  }
  if (
    typeof porcentajeDedicacion !== 'number' ||
    !Number.isFinite(porcentajeDedicacion) ||
    porcentajeDedicacion <= 0 ||
    porcentajeDedicacion > 100
  ) {
    throw new ErrorApp(
      'El porcentaje de dedicación debe ser mayor a 0 y no superar el 100 %',
      400,
      CODIGOS.VALIDACION
    );
  }
  if (typeof horasAsignadas !== 'number' || !Number.isFinite(horasAsignadas) || horasAsignadas <= 0) {
    throw new ErrorApp('Las horas asignadas deben ser un número positivo', 400, CODIGOS.VALIDACION);
  }

  const colaborador = await validarColaboradorActivo(colaboradorId);
  const proyecto = await validarProyectoActivo(proyectoId);
  if (!Number.isFinite(colaborador.dedicacionReservada) ||
    colaborador.dedicacionReservada < 0 || colaborador.dedicacionReservada > 100) {
    throw new ErrorApp('El colaborador requiere inicializar su dedicación reservada antes de asignarlo',
      409, CODIGOS.CONFLICTO);
  }

  dedicacion.verificarLiderDistinto(proyecto, colaborador);
  await validarCuentaActiva(colaborador);
  const elegibilidad = await dedicacion.verificarHabilidadesObligatorias(proyectoId, colaboradorId);
  const sumaActual = await obtenerSumaDedicacionActiva(colaboradorId);
  if (sumaActual + porcentajeDedicacion > 100) {
    throw new ErrorApp(
      'La suma de dedicaciones activas del colaborador superaría el 100 %',
      400,
      CODIGOS.VALIDACION
    );
  }

  await dedicacion.verificarAsignacionUnica(proyectoId, colaboradorId);
  const asignacionId = dedicacion.idAsignacionUnica(proyectoId, colaboradorId);
  const ahora = ahoraISO();
  const item = {
    asignacionId,
    colaboradorId,
    proyectoId,
    ...(postulacionId && { postulacionId }),
    porcentajeDedicacion,
    horasAsignadas,
    horasCompletadas: 0,
    fechaInicio: fechaInicio || ahora,
    estado: 'ACTIVA',
    fechaAsignacion: ahora,
    fechaActualizacion: ahora,
    creadoPor,
    colaboradorFechaKey: `ACTIVA#${ahora}`,
    proyectoFechaKey: `ACTIVA#${ahora}`,
    estadoFechaKey: `${ahora}#${asignacionId}`,
  };

  await dedicacion.ejecutar([
    dedicacion.reserva(colaboradorId, porcentajeDedicacion, elegibilidad.habilidadesRevision ?? 0),
    dedicacion.actividadProyecto(proyectoId, 1, colaborador.usuarioId, elegibilidad.requisitosRevision ?? 0),
    dedicacion.cuentaActiva(colaborador.usuarioId, tableUsuarios),
    { ConditionCheck: {
      TableName: tablePostulaciones,
      Key: { proyectoId, postulacionKey: `POSTULACION#${colaboradorId}` },
      ConditionExpression: 'attribute_not_exists(postulacionKey) OR #estado <> :pendiente',
      ExpressionAttributeNames: { '#estado': 'estado' },
      ExpressionAttributeValues: { ':pendiente': 'PENDIENTE' },
    } },
    { Put: { TableName: tableAsignaciones, Item: item,
      ConditionExpression: 'attribute_not_exists(asignacionId)' } },
  ]);

  invalidarCachéAsignacion(asignacionId, colaboradorId, proyectoId);
  return item;
}

async function listarAsignacionesActivas() {
  const clave = claveAsignacionesActivas();
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const items = await consultarTodasPaginas({
      TableName: tableAsignaciones,
      IndexName: 'GSI3',
      KeyConditionExpression: '#est = :est',
      ExpressionAttributeNames: { '#est': 'estado' },
      ExpressionAttributeValues: { ':est': 'ACTIVA' },
  });

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

async function listarAsignacionesColaborador(colaboradorId) {
  const clave = claveAsignacionesColaborador(colaboradorId);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const items = await consultarTodasPaginas({
      TableName: tableAsignaciones,
      IndexName: 'GSI1',
      KeyConditionExpression: '#c = :c',
      ExpressionAttributeNames: { '#c': 'colaboradorId' },
      ExpressionAttributeValues: { ':c': colaboradorId },
  });

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

async function listarAsignacionesProyecto(proyectoId) {
  const clave = claveAsignacionesProyecto(proyectoId);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const items = await consultarTodasPaginas({
      TableName: tableAsignaciones,
      IndexName: 'GSI2',
      KeyConditionExpression: '#p = :p',
      ExpressionAttributeNames: { '#p': 'proyectoId' },
      ExpressionAttributeValues: { ':p': proyectoId },
  });

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

async function obtenerAsignacion(asignacionId) {
  const clave = claveAsignacion(asignacionId);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const resultado = await dynamoDb.send(new GetCommand({
    TableName: tableAsignaciones,
    Key: { asignacionId },
  }));
  const asignacion = resultado.Item;
  if (!asignacion) {
    throw new ErrorApp('Asignación no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }

  cache.guardar(clave, asignacion, CACHE_TTL_MS);
  return asignacion;
}

function validarHorasAsignadas(horasAsignadas, horasCompletadas) {
  if (typeof horasAsignadas !== 'number' || !Number.isFinite(horasAsignadas) || horasAsignadas <= 0) {
    throw new ErrorApp('Las horas asignadas deben ser un número positivo', 400, CODIGOS.VALIDACION);
  }
  if (horasCompletadas > horasAsignadas) {
    throw new ErrorApp('Las horas asignadas no pueden ser menores a las horas completadas', 400, CODIGOS.VALIDACION);
  }
}

async function validarPorcentajeActualizado(porcentajeDedicacion, existente, asignacionId) {
  if (typeof porcentajeDedicacion !== 'number' || !Number.isFinite(porcentajeDedicacion) ||
      porcentajeDedicacion <= 0 || porcentajeDedicacion > 100) {
    throw new ErrorApp('El porcentaje de dedicación debe estar entre 1 y 100', 400, CODIGOS.VALIDACION);
  }
  const sumaOtros = await obtenerSumaDedicacionActiva(existente.colaboradorId, asignacionId);
  if (sumaOtros + porcentajeDedicacion > 100) {
    throw new ErrorApp('La suma de dedicaciones activas del colaborador superaría el 100 %',
      400, CODIGOS.VALIDACION);
  }
}

function validarHorasCompletadas(horasCompletadas, horasAsignadas) {
  if (typeof horasCompletadas !== 'number' || !Number.isFinite(horasCompletadas) || horasCompletadas < 0) {
    throw new ErrorApp('Las horas completadas no pueden ser negativas', 400, CODIGOS.VALIDACION);
  }
  if (horasCompletadas > horasAsignadas) {
    throw new ErrorApp('Las horas completadas no pueden superar las horas asignadas', 400, CODIGOS.VALIDACION);
  }
}

async function actualizarAsignacion(asignacionId, cambios) {
  const { horasAsignadas, porcentajeDedicacion, horasCompletadas } = cambios;
  const existente = await obtenerAsignacion(asignacionId);

  const sets = [];
  const nombresAtributos = {};
  const valoresAtributos = {};
  const ahora = ahoraISO();

  if (horasAsignadas !== undefined) {
    validarHorasAsignadas(horasAsignadas, existente.horasCompletadas);
    nombresAtributos['#ha'] = 'horasAsignadas';
    valoresAtributos[':ha'] = horasAsignadas;
    sets.push('#ha = :ha');
  }

  if (porcentajeDedicacion !== undefined) {
    await validarPorcentajeActualizado(porcentajeDedicacion, existente, asignacionId);
    nombresAtributos['#pd'] = 'porcentajeDedicacion';
    valoresAtributos[':pd'] = porcentajeDedicacion;
    sets.push('#pd = :pd');
    nombresAtributos['#s1'] = 'colaboradorFechaKey';
    valoresAtributos[':s1'] = `ACTIVA#${ahora}`;
    sets.push('#s1 = :s1');
    nombresAtributos['#s2'] = 'proyectoFechaKey';
    valoresAtributos[':s2'] = `ACTIVA#${ahora}`;
    sets.push('#s2 = :s2');
  }

  if (horasCompletadas !== undefined) {
    validarHorasCompletadas(horasCompletadas, horasAsignadas ?? existente.horasAsignadas);
    nombresAtributos['#hc'] = 'horasCompletadas';
    valoresAtributos[':hc'] = horasCompletadas;
    sets.push('#hc = :hc');
  }

  nombresAtributos['#ua'] = 'fechaActualizacion';
  valoresAtributos[':ua'] = ahora;
  sets.push('#ua = :ua');

  if (sets.length <= 1) {
    throw new ErrorApp('No hay campos para actualizar', 400, CODIGOS.VALIDACION);
  }

  if (existente.estado !== 'ACTIVA') {
    throw new ErrorApp('Asignación no activa', 404, CODIGOS.NO_ENCONTRADO);
  }
  const delta = (porcentajeDedicacion ?? existente.porcentajeDedicacion) - existente.porcentajeDedicacion;
  await dedicacion.ejecutar([
    dedicacion.reserva(existente.colaboradorId, delta),
    { Update: {
      TableName: tableAsignaciones, Key: { asignacionId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ConditionExpression: '#est = :activa AND porcentajeDedicacion = :anterior AND horasAsignadas = :horasPrevias AND horasCompletadas = :completadasPrevias',
      ExpressionAttributeNames: { ...nombresAtributos, '#est': 'estado' },
      ExpressionAttributeValues: { ...valoresAtributos, ':activa': 'ACTIVA',
        ':anterior': existente.porcentajeDedicacion, ':horasPrevias': existente.horasAsignadas,
        ':completadasPrevias': existente.horasCompletadas },
    } },
  ]);
  invalidarCachéAsignacion(asignacionId, existente.colaboradorId, existente.proyectoId);
  const resultado = { ...existente, fechaActualizacion: ahora };
  if (horasAsignadas !== undefined) resultado.horasAsignadas = horasAsignadas;
  if (horasCompletadas !== undefined) resultado.horasCompletadas = horasCompletadas;
  if (porcentajeDedicacion !== undefined) resultado.porcentajeDedicacion = porcentajeDedicacion;
  return resultado;
}

async function cambiarEstadoFinal(asignacionId, estadoFinal) {
  if (!['DESVINCULADA', 'FINALIZADA'].includes(estadoFinal)) {
    throw new ErrorApp('Estado final inválido', 400, CODIGOS.VALIDACION);
  }
  const existente = await obtenerAsignacion(asignacionId);
  if (existente.estado !== 'ACTIVA') {
    throw new ErrorApp('La asignación ya no está activa', 409, CODIGOS.CONFLICTO);
  }
  const ahora = ahoraISO();
  await dedicacion.ejecutar([
    dedicacion.reserva(existente.colaboradorId, -existente.porcentajeDedicacion),
    dedicacion.actividadProyecto(existente.proyectoId, -1),
    { Update: {
      TableName: tableAsignaciones, Key: { asignacionId },
      UpdateExpression: 'SET #est = :estado, fechaFin = :fecha, fechaActualizacion = :fecha, colaboradorFechaKey = :key, proyectoFechaKey = :key',
      ConditionExpression: '#est = :activa AND porcentajeDedicacion = :anterior',
      ExpressionAttributeNames: { '#est': 'estado' },
      ExpressionAttributeValues: { ':estado': estadoFinal, ':activa': 'ACTIVA',
        ':anterior': existente.porcentajeDedicacion, ':fecha': ahora, ':key': `${estadoFinal}#${ahora}` },
    } },
  ]);
  invalidarCachéAsignacion(asignacionId, existente.colaboradorId, existente.proyectoId);
  return { ...existente, estado: estadoFinal, fechaFin: ahora, fechaActualizacion: ahora };
}

async function desvincularAsignacion(asignacionId) {
  return cambiarEstadoFinal(asignacionId, 'DESVINCULADA');
}

async function finalizarAsignacion(asignacionId) {
  return cambiarEstadoFinal(asignacionId, 'FINALIZADA');
}

module.exports = {
  crearAsignacion,
  listarAsignacionesActivas,
  listarAsignacionesColaborador,
  listarAsignacionesProyecto,
  obtenerAsignacion,
  actualizarAsignacion,
  desvincularAsignacion,
  finalizarAsignacion,
  validarColaboradorActivo,
  validarProyectoActivo,
  obtenerSumaDedicacionActiva,
};
