const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} = require('../config/dynamodb');
const { tableHabilidades } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');

function normalizarNombre(nombre) {
  return nombre.trim().toLowerCase();
}

async function crear(data) {
  const nombreNormalizado = normalizarNombre(data.nombre);

  const item = {
    habilidadId: data.habilidadId,
    nombre: data.nombre.trim(),
    nombreNormalizado,
    categoria: data.categoria || 'GENERAL',
    estado: data.estado || 'ACTIVO',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
  };

  if (data.habilidadId.startsWith('UNIQUE#')) throw new ErrorApp('Identificador reservado', 400, CODIGOS.VALIDACION);
  await escribir([
    { Put: { TableName: tableHabilidades, Item: item, ConditionExpression: 'attribute_not_exists(habilidadId)' } },
    { Put: { TableName: tableHabilidades, Item: { habilidadId: `UNIQUE#${nombreNormalizado}`, propietarioId: item.habilidadId },
      ConditionExpression: 'attribute_not_exists(habilidadId)' } },
  ]);

  return item;
}

async function listar(filtros = {}) {
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

  if (lastKey) params.ExclusiveStartKey = lastKey;

  const result = await dynamoDb.send(new ScanCommand(params));
  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey || null,
  };
}

async function obtenerPorId(habilidadId) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: tableHabilidades,
      Key: { habilidadId },
    })
  );
  return result.Item || null;
}

async function actualizar(habilidadId, data) {
  const existente = await obtenerPorId(habilidadId);
  if (!existente) {
    throw new ErrorApp('Habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }

  const siguiente = { ...existente, fechaActualizacion: new Date().toISOString() };
  for (const campo of ['nombre', 'categoria', 'estado']) {
    if (data[campo] !== undefined) siguiente[campo] = data[campo];
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
  return siguiente;
}

async function escribir(items) {
  try { await dynamoDb.send(new TransactWriteCommand({ TransactItems: items })); }
  catch (err) {
    if (err.name === 'TransactionCanceledException') throw new ErrorApp('Nombre duplicado o modificación concurrente', 409, CODIGOS.CONFLICTO);
    throw err;
  }
}

async function cambiarEstado(habilidadId, activo) {
  const estado = activo ? 'ACTIVO' : 'INACTIVO';
  return actualizar(habilidadId, { estado });
}

async function obtenerPorNombreNormalizado(nombreNormalizado) {
  const result = await dynamoDb.send(new GetCommand({
    TableName: tableHabilidades, Key: { habilidadId: `UNIQUE#${normalizarNombre(nombreNormalizado)}` }, ConsistentRead: true,
  }));
  return result.Item ? obtenerPorId(result.Item.propietarioId) : null;
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