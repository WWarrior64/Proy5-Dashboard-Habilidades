const { v4: uuidv4 } = require('uuid');
const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} = require('../../src/config/dynamodb.js');
const { tableProyectos, tableUsuarios } = require('../../src/config/environment.js');
const { ErrorApp, CODIGOS } = require('../../src/utils/errors.js');
const cache = require('../../src/services/cache.service.js');

const CACHE_TTL_MS = 60000;
const ESTADOS_VALIDOS = ['BORRADOR', 'ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO'];

function ahoraISO() {
  return new Date().toISOString();
}

async function consultarTodasPaginas(parametros) {
  const items = [];
  let lastKey;
  do {
    const pagina = await dynamoDb.send(new QueryCommand({
      ...parametros,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    items.push(...(pagina.Items || []));
    lastKey = pagina.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

function claveProyecto(proyectoId) {
  return `proyecto:${proyectoId}`;
}

function claveListaProyectos(filtros = {}) {
  return `proyectos:list:${cache.construirClave(
    String(filtros.estado ?? ''),
    String(filtros.liderId ?? ''),
    String(filtros.fecha ?? '')
  )}`;
}

function claveProyectosActivos() {
  return 'proyectos:activos';
}

/**
 * Invalida las entradas de caché afectadas por una escritura sobre un proyecto:
 * el proyecto en particular, el listado de activos y los listados filtrados.
 * @param {string} proyectoId
 */
function invalidarCachéProyecto(proyectoId) {
  cache.eliminar(claveProyecto(proyectoId));
  cache.eliminar(claveProyectosActivos());
  cache.eliminarPorPrefijo('proyectos:list:');
}

async function validarLider(liderId) {
  const resultado = await dynamoDb.send(
    new GetCommand({
      TableName: tableUsuarios,
      Key: { usuarioId: liderId },
    })
  );
  const usuario = resultado.Item;
  if (!usuario) {
    throw new ErrorApp('El líder especificado no existe', 404, CODIGOS.NO_ENCONTRADO);
  }
  if (usuario.rol !== 'LIDER_PROYECTO') {
    throw new ErrorApp('El líder debe tener el rol LIDER_PROYECTO', 400, CODIGOS.VALIDACION);
  }
  if (usuario.estado !== 'ACTIVO') {
    throw new ErrorApp('El líder no está activo', 400, CODIGOS.VALIDACION);
  }
  return usuario;
}

function validarEstado(estado) {
  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw new ErrorApp(
      `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`,
      400,
      CODIGOS.VALIDACION
    );
  }
}

function validarFechas(inicio, fin) {
  for (const valor of [inicio, fin]) {
    if (valor !== undefined && valor !== null &&
      (typeof valor !== 'string' || !Number.isFinite(Date.parse(valor)))) {
      throw new ErrorApp('Las fechas deben ser cadenas de fecha válidas', 400, CODIGOS.VALIDACION);
    }
  }
  if (inicio && fin && Date.parse(fin) < Date.parse(inicio)) {
    throw new ErrorApp('fechaFin no puede ser anterior a fechaInicio', 400, CODIGOS.VALIDACION);
  }
}

function itemBaseProyecto(proyectoId, datos, ahora) {
  const { estado, objetivo, fechaInicio, fechaFin, fechaPublicacion } = datos;
  return {
    proyectoId,
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    liderId: datos.liderId,
    horasRequeridas: datos.horasRequeridas,
    estado,
    fechaPublicacion: fechaPublicacion || ahora,
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
    creadoPor: datos.creadoPor,
    ...(objetivo !== undefined && { objetivo }),
    ...(fechaInicio !== undefined && { fechaInicio }),
    ...(fechaFin !== undefined && { fechaFin }),
    // Claves de orden de los GSIs (GSI1: estado / fechaPublicacion#proyectoId;
    // GSI2: liderId / estado#fechaCreacion)
    fechaPublicacionKey: `${fechaPublicacion || ahora}#${proyectoId}`,
    estadoFechaKey: `${estado}#${ahora}`,
  };
}

async function crearProyecto(datos) {
  const {
    nombre,
    descripcion,
    liderId,
    horasRequeridas,
    creadoPor,
    proyectoId: proyectoIdEntrada,
  } = datos;

  if (!nombre || !descripcion || !liderId || horasRequeridas === undefined || !creadoPor) {
    throw new ErrorApp(
      'nombre, descripcion, liderId, horasRequeridas y creadoPor son obligatorios',
      400,
      CODIGOS.VALIDACION
    );
  }
  if (typeof horasRequeridas !== 'number' || !Number.isFinite(horasRequeridas) || horasRequeridas <= 0) {
    throw new ErrorApp('Las horas requeridas deben ser un número positivo', 400, CODIGOS.VALIDACION);
  }

  const estado = datos.estado || 'BORRADOR';
  validarEstado(estado);
  validarFechas(datos.fechaInicio, datos.fechaFin);
  if (datos.fechaPublicacion !== undefined) validarFechas(datos.fechaPublicacion);
  await validarLider(liderId);

  const proyectoId = proyectoIdEntrada || uuidv4();
  const ahora = ahoraISO();
  const item = itemBaseProyecto(proyectoId, { ...datos, estado }, ahora);

  await dynamoDb.send(
    new PutCommand({
      TableName: tableProyectos,
      Item: item,
      ConditionExpression: 'attribute_not_exists(proyectoId)',
    })
  );

  invalidarCachéProyecto(proyectoId);
  return item;
}

async function obtenerProyecto(proyectoId) {
  const clave = claveProyecto(proyectoId);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const resultado = await dynamoDb.send(
    new GetCommand({
      TableName: tableProyectos,
      Key: { proyectoId },
    })
  );
  const proyecto = resultado.Item;
  if (!proyecto) {
    throw new ErrorApp('Proyecto no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  }

  cache.guardar(clave, proyecto, CACHE_TTL_MS);
  return proyecto;
}

async function listarProyectos(filtros = {}) {
  const { estado, liderId, fecha } = filtros;
  const clave = claveListaProyectos(filtros);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  let items;
  const nombresAtributos = {};
  const valoresAtributos = {};

  if (liderId) {
    nombresAtributos['#lid'] = 'liderId';
    valoresAtributos[':lid'] = liderId;
    const condicionesFiltro = [];
    if (estado) {
      nombresAtributos['#est'] = 'estado';
      valoresAtributos[':est'] = estado;
      condicionesFiltro.push('#est = :est');
    }
    if (fecha) {
      nombresAtributos['#fp'] = 'fechaPublicacion';
      valoresAtributos[':fecha'] = fecha;
      condicionesFiltro.push('#fp >= :fecha');
    }
    const params = {
      TableName: tableProyectos,
      IndexName: 'GSI2',
      KeyConditionExpression: '#lid = :lid',
      ExpressionAttributeNames: nombresAtributos,
      ExpressionAttributeValues: valoresAtributos,
    };
    if (condicionesFiltro.length > 0) {
      params.FilterExpression = condicionesFiltro.join(' AND ');
    }
    items = await consultarTodasPaginas(params);
  } else if (estado) {
    nombresAtributos['#est'] = 'estado';
    valoresAtributos[':est'] = estado;
    const params = {
      TableName: tableProyectos,
      IndexName: 'GSI1',
      KeyConditionExpression: '#est = :est',
      ExpressionAttributeNames: nombresAtributos,
      ExpressionAttributeValues: valoresAtributos,
    };
    if (fecha) {
      nombresAtributos['#fp'] = 'fechaPublicacion';
      valoresAtributos[':fecha'] = fecha;
      params.FilterExpression = '#fp >= :fecha';
    }
    items = await consultarTodasPaginas(params);
  } else {
    throw new ErrorApp('Se requiere al menos un filtro: estado o liderId', 400, CODIGOS.VALIDACION);
  }

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

async function actualizarProyecto(proyectoId, cambios) {
  const { nombre, descripcion, liderId, horasRequeridas, fechaInicio, fechaFin, estado } = cambios;
  if (fechaInicio !== undefined || fechaFin !== undefined) {
    const actual = await obtenerProyecto(proyectoId);
    validarFechas(fechaInicio ?? actual.fechaInicio, fechaFin ?? actual.fechaFin);
  }
  const sets = [];
  const nombresAtributos = {};
  const valoresAtributos = {};
  const ahora = ahoraISO();

  if (nombre !== undefined) {
    nombresAtributos['#n'] = 'nombre';
    valoresAtributos[':n'] = nombre;
    sets.push('#n = :n');
  }
  if (descripcion !== undefined) {
    nombresAtributos['#d'] = 'descripcion';
    valoresAtributos[':d'] = descripcion;
    sets.push('#d = :d');
  }
  if (liderId !== undefined) {
    await validarLider(liderId);
    nombresAtributos['#lid'] = 'liderId';
    valoresAtributos[':lid'] = liderId;
    sets.push('#lid = :lid');
  }
  if (horasRequeridas !== undefined) {
    if (typeof horasRequeridas !== 'number' || !Number.isFinite(horasRequeridas) || horasRequeridas <= 0) {
      throw new ErrorApp('Las horas requeridas deben ser un número positivo', 400, CODIGOS.VALIDACION);
    }
    nombresAtributos['#hr'] = 'horasRequeridas';
    valoresAtributos[':hr'] = horasRequeridas;
    sets.push('#hr = :hr');
  }
  if (fechaInicio !== undefined) {
    nombresAtributos['#fi'] = 'fechaInicio';
    valoresAtributos[':fi'] = fechaInicio;
    sets.push('#fi = :fi');
  }
  if (fechaFin !== undefined) {
    nombresAtributos['#ff'] = 'fechaFin';
    valoresAtributos[':ff'] = fechaFin;
    sets.push('#ff = :ff');
  }
  if (estado !== undefined) {
    validarEstado(estado);
    nombresAtributos['#est'] = 'estado';
    valoresAtributos[':est'] = estado;
    sets.push('#est = :est');
    nombresAtributos['#s2'] = 'estadoFechaKey';
    valoresAtributos[':s2'] = `${estado}#${ahora}`;
    sets.push('#s2 = :s2');
  }

  nombresAtributos['#ua'] = 'fechaActualizacion';
  valoresAtributos[':ua'] = ahora;
  sets.push('#ua = :ua');

  if (sets.length <= 1) {
    throw new ErrorApp('No hay campos para actualizar', 400, CODIGOS.VALIDACION);
  }

  try {
    const resultado = await dynamoDb.send(new UpdateCommand({
      TableName: tableProyectos,
      Key: { proyectoId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: nombresAtributos,
      ExpressionAttributeValues: valoresAtributos,
      ConditionExpression: 'attribute_exists(proyectoId)',
      ReturnValues: 'ALL_NEW',
    }));
    if (!resultado.Attributes) {
      throw new ErrorApp('Proyecto no encontrado', 404, CODIGOS.NO_ENCONTRADO);
    }
    invalidarCachéProyecto(proyectoId);
    return resultado.Attributes;
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('Proyecto no encontrado', 404, CODIGOS.NO_ENCONTRADO);
    }
    throw e;
  }
}

async function cambiarEstado(proyectoId, estado) {
  validarEstado(estado);
  const ahora = ahoraISO();
  try {
    const resultado = await dynamoDb.send(new UpdateCommand({
      TableName: tableProyectos,
      Key: { proyectoId },
      UpdateExpression: 'SET #est = :est, #s2 = :s2, #ua = :ua',
      ExpressionAttributeNames: { '#est': 'estado', '#s2': 'estadoFechaKey', '#ua': 'fechaActualizacion' },
      ExpressionAttributeValues: {
        ':est': estado,
        ':s2': `${estado}#${ahora}`,
        ':ua': ahora,
      },
      ConditionExpression: 'attribute_exists(proyectoId)',
      ReturnValues: 'ALL_NEW',
    }));
    invalidarCachéProyecto(proyectoId);
    return resultado.Attributes;
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('Proyecto no encontrado', 404, CODIGOS.NO_ENCONTRADO);
    }
    throw e;
  }
}

async function cancelarProyecto(proyectoId) {
  // Cancelar es un cambio lógico de estado a CANCELADO; el ítem se conserva
  // para mantener el historial (no se elimina físicamente).
  return cambiarEstado(proyectoId, 'CANCELADO');
}

async function listarProyectosActivos() {
  const clave = claveProyectosActivos();
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const items = await consultarTodasPaginas({
      TableName: tableProyectos,
      IndexName: 'GSI1',
      KeyConditionExpression: '#est = :est',
      ExpressionAttributeNames: { '#est': 'estado' },
      ExpressionAttributeValues: { ':est': 'ACTIVO' },
  });

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

module.exports = {
  crearProyecto,
  obtenerProyecto,
  listarProyectos,
  actualizarProyecto,
  cambiarEstado,
  cancelarProyecto,
  listarProyectosActivos,
  validarLider,
  validarEstado,
  ESTADOS_VALIDOS,
  claveProyecto,
  claveListaProyectos,
  claveProyectosActivos,
  invalidarCachéProyecto,
};
