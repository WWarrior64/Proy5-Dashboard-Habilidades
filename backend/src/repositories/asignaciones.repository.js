const dedicacion = require('../services/dedicacion.service');
const { v4: uuidv4 } = require('uuid');
const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} = require('../../src/config/dynamodb.js');
const {
  tableAsignaciones,
  tableColaboradores,
  tableProyectos,
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
  const resultado = await dynamoDb.send(
    new QueryCommand({
      TableName: tableAsignaciones,
      IndexName: 'GSI1',
      KeyConditionExpression: '#c = :c AND begins_with(#s, :prefijo)',
      ExpressionAttributeNames: { '#c': 'colaboradorId', '#s': 'colaboradorFechaKey' },
      ExpressionAttributeValues: { ':c': colaboradorId, ':prefijo': 'ACTIVA#' },
      ProjectionExpression: 'porcentajeDedicacion, asignacionId',
    })
  );
  return (resultado.Items || [])
    .filter((item) => item.asignacionId !== asignacionIdExcluir)
    .reduce((acc, item) => acc + (item.porcentajeDedicacion || 0), 0);
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
    asignacionId: asignacionIdEntrada,
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

  await validarColaboradorActivo(colaboradorId);
  await validarProyectoActivo(proyectoId);

  const sumaActual = await obtenerSumaDedicacionActiva(colaboradorId);
  if (sumaActual + porcentajeDedicacion > 100) {
    throw new ErrorApp(
      'La suma de dedicaciones activas del colaborador superaría el 100 %',
      400,
      CODIGOS.VALIDACION
    );
  }

  const asignacionId = asignacionIdEntrada || uuidv4();
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
    dedicacion.reserva(colaboradorId, porcentajeDedicacion),
    { ConditionCheck: { TableName: tableProyectos, Key: { proyectoId },
      ConditionExpression: '#e = :e', ExpressionAttributeNames: { '#e': 'estado' },
      ExpressionAttributeValues: { ':e': 'ACTIVO' } } },
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

  const resultado = await dynamoDb.send(
    new QueryCommand({
      TableName: tableAsignaciones,
      IndexName: 'GSI3',
      KeyConditionExpression: '#est = :est',
      ExpressionAttributeNames: { '#est': 'estado' },
      ExpressionAttributeValues: { ':est': 'ACTIVA' },
    })
  );
  const items = resultado.Items || [];

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

async function listarAsignacionesColaborador(colaboradorId) {
  const clave = claveAsignacionesColaborador(colaboradorId);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const resultado = await dynamoDb.send(
    new QueryCommand({
      TableName: tableAsignaciones,
      IndexName: 'GSI1',
      KeyConditionExpression: '#c = :c AND begins_with(#s, :prefijo)',
      ExpressionAttributeNames: { '#c': 'colaboradorId', '#s': 'colaboradorFechaKey' },
      ExpressionAttributeValues: { ':c': colaboradorId, ':prefijo': 'ACTIVA#' },
    })
  );
  const items = resultado.Items || [];

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

async function listarAsignacionesProyecto(proyectoId) {
  const clave = claveAsignacionesProyecto(proyectoId);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const resultado = await dynamoDb.send(
    new QueryCommand({
      TableName: tableAsignaciones,
      IndexName: 'GSI2',
      KeyConditionExpression: '#p = :p AND begins_with(#s, :prefijo)',
      ExpressionAttributeNames: { '#p': 'proyectoId', '#s': 'proyectoFechaKey' },
      ExpressionAttributeValues: { ':p': proyectoId, ':prefijo': 'ACTIVA#' },
    })
  );
  const items = resultado.Items || [];

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

async function actualizarAsignacion(asignacionId, cambios) {
  const { horasAsignadas, porcentajeDedicacion, horasCompletadas } = cambios;
  const existente = await obtenerAsignacion(asignacionId);

  const sets = [];
  const nombresAtributos = {};
  const valoresAtributos = {};
  const ahora = ahoraISO();

  if (horasAsignadas !== undefined) {
    if (typeof horasAsignadas !== 'number' || !Number.isFinite(horasAsignadas) || horasAsignadas <= 0) {
      throw new ErrorApp('Las horas asignadas deben ser un número positivo', 400, CODIGOS.VALIDACION);
    }
    if (existente.horasCompletadas > horasAsignadas) {
      throw new ErrorApp(
        'Las horas asignadas no pueden ser menores a las horas completadas',
        400,
        CODIGOS.VALIDACION
      );
    }
    nombresAtributos['#ha'] = 'horasAsignadas';
    valoresAtributos[':ha'] = horasAsignadas;
    sets.push('#ha = :ha');
  }

  if (porcentajeDedicacion !== undefined) {
    if (
      typeof porcentajeDedicacion !== 'number' ||
      !Number.isFinite(porcentajeDedicacion) ||
      porcentajeDedicacion <= 0 ||
      porcentajeDedicacion > 100
    ) {
      throw new ErrorApp(
        'El porcentaje de dedicación debe estar entre 1 y 100',
        400,
        CODIGOS.VALIDACION
      );
    }
    const sumaOtros = await obtenerSumaDedicacionActiva(existente.colaboradorId, asignacionId);
    if (sumaOtros + porcentajeDedicacion > 100) {
      throw new ErrorApp(
        'La suma de dedicaciones activas del colaborador superaría el 100 %',
        400,
        CODIGOS.VALIDACION
      );
    }
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
    if (typeof horasCompletadas !== 'number' || !Number.isFinite(horasCompletadas) || horasCompletadas < 0) {
      throw new ErrorApp('Las horas completadas no pueden ser negativas', 400, CODIGOS.VALIDACION);
    }
    const horasFinal = horasAsignadas !== undefined ? horasAsignadas : existente.horasAsignadas;
    if (horasCompletadas > horasFinal) {
      throw new ErrorApp(
        'Las horas completadas no pueden superar las horas asignadas',
        400,
        CODIGOS.VALIDACION
      );
    }
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

async function desvincularAsignacion(asignacionId) {
  const existente = await obtenerAsignacion(asignacionId);
  if (existente.estado === 'DESVINCULADA') {
    throw new ErrorApp('La asignación ya está desvinculada', 409, CODIGOS.CONFLICTO);
  }
  const ahora = ahoraISO();
  await dedicacion.ejecutar([
    dedicacion.reserva(existente.colaboradorId, -existente.porcentajeDedicacion),
    { Update: {
      TableName: tableAsignaciones, Key: { asignacionId },
      UpdateExpression: 'SET #est = :estado, fechaFin = :fecha, fechaActualizacion = :fecha, colaboradorFechaKey = :key, proyectoFechaKey = :key',
      ConditionExpression: '#est = :activa AND porcentajeDedicacion = :anterior',
      ExpressionAttributeNames: { '#est': 'estado' },
      ExpressionAttributeValues: { ':estado': 'DESVINCULADA', ':activa': 'ACTIVA',
        ':anterior': existente.porcentajeDedicacion, ':fecha': ahora, ':key': `DESVINCULADA#${ahora}` },
    } },
  ]);
  invalidarCachéAsignacion(asignacionId, existente.colaboradorId, existente.proyectoId);
  return { ...existente, estado: 'DESVINCULADA', fechaFin: ahora, fechaActualizacion: ahora };
}

module.exports = {
  crearAsignacion,
  listarAsignacionesActivas,
  listarAsignacionesColaborador,
  listarAsignacionesProyecto,
  obtenerAsignacion,
  actualizarAsignacion,
  desvincularAsignacion,
  validarColaboradorActivo,
  validarProyectoActivo,
  obtenerSumaDedicacionActiva,
};
