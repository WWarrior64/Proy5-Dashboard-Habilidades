const {
  dynamoDb,
  GetCommand,
  ScanCommand,
  TransactWriteCommand,
} = require('../config/dynamodb');
const { tableHabilidades } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');
const { randomUUID } = require('node:crypto');
const cache = require('../services/cache.service.js');

// TTL de los catálogos de habilidades en segundos. Sobrescribible por variable
// de entorno (catálogo de habilidades con caché temporal, expiración e invalidación).
const ttlCatalogoHabilidadesEnv = Number(process.env.CACHE_TTL_CATALOG_SECONDS);
const TTL_HABILIDAD_SEGUNDOS =
  Number.isFinite(ttlCatalogoHabilidadesEnv) && ttlCatalogoHabilidadesEnv > 0
    ? ttlCatalogoHabilidadesEnv
    : 60;
const TTL_HABILIDAD_MS = TTL_HABILIDAD_SEGUNDOS * 1000;

function normalizarNombre(nombre) {
  return nombre.trim().toLowerCase();
}

function claveListarHabilidades(filtros) {
  return cache.construirClave(
    'habilidades',
    'list',
    JSON.stringify({
      categoria: filtros.categoria || null,
      nombre: filtros.nombre || null,
      estado: filtros.estado || null,
      limit: filtros.limit ?? 25,
      lastKey: filtros.lastKey || null,
    })
  );
}

function claveObtenerHabilidad(habilidadId) {
  return cache.construirClave('habilidades', 'obtener', habilidadId);
}

function claveHabilidadPorNombre(nombreNormalizado) {
  return cache.construirClave('habilidades', 'nombre', nombreNormalizado);
}

/**
 * Invalida las claves de caché de habilidades afectadas por una escritura.
 * Se ejecuta solo tras una escritura exitosa en DynamoDB.
 * @param {string} [habilidadId] - Identificador de la habilidad modificada, si aplica
 */
function invalidarCachéHabilidades(habilidadId) {
  cache.eliminarPorPrefijo('habilidades:list:');
  cache.eliminarPorPrefijo('habilidades:obtener:');
  cache.eliminarPorPrefijo('habilidades:nombre:');
  if (habilidadId) {cache.eliminar(claveObtenerHabilidad(habilidadId));}
}

async function crear(data) {
  if (typeof data.nombre !== 'string' || !data.nombre.trim()) {
    throw new ErrorApp('nombre de habilidad obligatorio', 400, CODIGOS.VALIDACION);
  }
  if (data.estado !== undefined && !['ACTIVO', 'INACTIVO'].includes(data.estado)) {
    throw new ErrorApp('Estado de habilidad inválido', 400, CODIGOS.VALIDACION);
  }
  const nombreNormalizado = normalizarNombre(data.nombre);

  const item = {
    habilidadId: data.habilidadId || randomUUID(),
    nombre: data.nombre.trim(),
    nombreNormalizado,
    categoria: data.categoria || 'GENERAL',
    ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
    estado: data.estado || 'ACTIVO',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
  };

  if (item.habilidadId.startsWith('UNIQUE#')) {throw new ErrorApp('Identificador reservado', 400, CODIGOS.VALIDACION);}
  await escribir([
    { Put: { TableName: tableHabilidades, Item: item, ConditionExpression: 'attribute_not_exists(habilidadId)' } },
    { Put: { TableName: tableHabilidades, Item: { habilidadId: `UNIQUE#${nombreNormalizado}`, propietarioId: item.habilidadId },
      ConditionExpression: 'attribute_not_exists(habilidadId)' } },
  ]);

  invalidarCachéHabilidades();
  return item;
}

async function listar(filtros = {}) {
  const clave = claveListarHabilidades(filtros);
  const cacheado = cache.obtener(clave);
  if (cacheado !== undefined) {return cacheado;}

  const { categoria, nombre, estado, limit = 25, lastKey } = filtros;

  const filterParts = ['attribute_exists(#nombreReal)'];
  const expressionAttributeValues = {};
  const expressionAttributeNames = { '#nombreReal': 'nombre' };

  if (categoria) {
    filterParts.push('#categoria = :categoria');
    expressionAttributeNames['#categoria'] = 'categoria';
    expressionAttributeValues[':categoria'] = categoria;
  }
  if (estado) {
    filterParts.push('#estado = :estado');
    expressionAttributeNames['#estado'] = 'estado';
    expressionAttributeValues[':estado'] = estado;
  }
  if (nombre) {
    filterParts.push('contains(#nombre, :nombre)');
    expressionAttributeNames['#nombre'] = 'nombre';
    expressionAttributeValues[':nombre'] = nombre.trim();
  }

  const params = {
    TableName: tableHabilidades,
    Limit: limit,
  };

  if (filterParts.length > 0) {
    params.FilterExpression = filterParts.join(' AND ');
    params.ExpressionAttributeNames = expressionAttributeNames;

    if (Object.keys(expressionAttributeValues).length > 0) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }
  }

  if (lastKey) {params.ExclusiveStartKey = lastKey;}

  const result = await dynamoDb.send(new ScanCommand(params));
  const respuesta = {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey || null,
  };
  cache.guardar(clave, respuesta, TTL_HABILIDAD_MS);
  return respuesta;
}

async function obtenerPorId(habilidadId) {
  if (String(habilidadId).startsWith('UNIQUE#')) {return null;}

  const clave = claveObtenerHabilidad(habilidadId);
  const cacheado = cache.obtener(clave);
  if (cacheado !== undefined) {return cacheado;}

  const result = await dynamoDb.send(
    new GetCommand({
      TableName: tableHabilidades,
      Key: { habilidadId },
    })
  );
  const item = result.Item || null;
  cache.guardar(clave, item, TTL_HABILIDAD_MS);
  return item;
}

async function actualizar(habilidadId, data) {
  if (data.nombre !== undefined && (typeof data.nombre !== 'string' || !data.nombre.trim())) {
    throw new ErrorApp('nombre de habilidad obligatorio', 400, CODIGOS.VALIDACION);
  }
  if (data.estado !== undefined && !['ACTIVO', 'INACTIVO'].includes(data.estado)) {
    throw new ErrorApp('Estado de habilidad inválido', 400, CODIGOS.VALIDACION);
  }
  const existente = await obtenerPorId(habilidadId);
  if (!existente) {
    throw new ErrorApp('Habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }

  const siguiente = { ...existente, fechaActualizacion: new Date().toISOString() };
  for (const campo of ['nombre', 'categoria', 'descripcion', 'estado']) {
    if (data[campo] !== undefined) {siguiente[campo] = data[campo];}
  }
  siguiente.nombreNormalizado = normalizarNombre(siguiente.nombre);
  const items = [{ Put: { TableName: tableHabilidades, Item: siguiente,
    ConditionExpression: 'fechaActualizacion = :version',
    ExpressionAttributeValues: { ':version': existente.fechaActualizacion } } }];
  if (siguiente.nombreNormalizado !== existente.nombreNormalizado) {
    items.push({ Delete: { TableName: tableHabilidades,
      Key: { habilidadId: `UNIQUE#${existente.nombreNormalizado}` },
      ConditionExpression: 'propietarioId = :id', ExpressionAttributeValues: { ':id': habilidadId } } });
    items.push({ Put: { TableName: tableHabilidades,
      Item: { habilidadId: `UNIQUE#${siguiente.nombreNormalizado}`, propietarioId: habilidadId },
      ConditionExpression: 'attribute_not_exists(habilidadId)' } });
  }
  await escribir(items);
  invalidarCachéHabilidades(habilidadId);
  return siguiente;
}

async function escribir(items) {
  try { await dynamoDb.send(new TransactWriteCommand({ TransactItems: items })); }
  catch (err) {
    if (err.name === 'TransactionCanceledException') {throw new ErrorApp('Nombre duplicado o modificación concurrente', 409, CODIGOS.CONFLICTO);}
    throw err;
  }
}

async function cambiarEstado(habilidadId, activo) {
  const estado = activo ? 'ACTIVO' : 'INACTIVO';
  return actualizar(habilidadId, { estado });
}

async function obtenerPorNombreNormalizado(nombreNormalizado) {
  const clave = claveHabilidadPorNombre(nombreNormalizado);
  const cacheado = cache.obtener(clave);
  if (cacheado !== undefined) {return cacheado;}

  const result = await dynamoDb.send(new GetCommand({
    TableName: tableHabilidades, Key: { habilidadId: `UNIQUE#${normalizarNombre(nombreNormalizado)}` }, ConsistentRead: true,
  }));
  const habilidad = result.Item ? await obtenerPorId(result.Item.propietarioId) : null;
  cache.guardar(clave, habilidad, TTL_HABILIDAD_MS);
  return habilidad;
}

module.exports = {
  crear,
  listar,
  obtenerPorId,
  actualizar,
  cambiarEstado,
  normalizarNombre,
  obtenerPorNombreNormalizado,
};