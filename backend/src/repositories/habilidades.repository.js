const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('../config/dynamodb');
const { tableHabilidades } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');

const PK_PREFIX = 'HABILIDAD';
const SK_METADATA = 'METADATA';

function pk(habilidadId) {
  return `${PK_PREFIX}#${habilidadId}`;
}

function sk() {
  return SK_METADATA;
}

function normalizarNombre(nombre) {
  return nombre.trim().toLowerCase();
}

async function crear(data) {
  const nombreNormalizado = normalizarNombre(data.nombre);

  const item = {
    pk: pk(data.habilidadId),
    sk: sk(),
    habilidadId: data.habilidadId,
    nombre: data.nombre.trim(),
    nombreNormalizado,
    categoria: data.categoria || 'GENERAL',
    estado: data.estado || 'ACTIVO',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    gsi1pk: `NOMBRE_NORMALIZADO#${nombreNormalizado}`,
    gsi1sk: SK_METADATA,
    gsi2pk: `CATEGORIA#${data.categoria || 'GENERAL'}`,
    gsi2sk: SK_METADATA,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: tableHabilidades,
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(gsi1pk)',
    })
  );

  return item;
}

async function listar(filtros = {}) {
  const { categoria, nombre, estado, limit = 25, lastKey } = filtros;

  const filterParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

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
    params.ExpressionAttributeValues = expressionAttributeValues;
    params.ExpressionAttributeNames = expressionAttributeNames;
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
      Key: { pk: pk(habilidadId), sk: sk() },
    })
  );
  return result.Item || null;
}

async function actualizar(habilidadId, data) {
  const existente = await obtenerPorId(habilidadId);
  if (!existente) {
    throw new ErrorApp('Habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }

  const updateParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  if (data.nombre !== undefined) {
    const nombreNormalizado = normalizarNombre(data.nombre);
    const duplicado = await obtenerPorNombreNormalizado(nombreNormalizado);
    if (duplicado && duplicado.habilidadId !== habilidadId) {
      throw new ErrorApp('Ya existe una habilidad con ese nombre normalizado', 409, CODIGOS.CONFLICTO);
    }
    updateParts.push('#nombre = :nombre, #nombreNormalizado = :nombreNormalizado');
    expressionAttributeNames['#nombre'] = 'nombre';
    expressionAttributeNames['#nombreNormalizado'] = 'nombreNormalizado';
    expressionAttributeValues[':nombre'] = data.nombre.trim();
    expressionAttributeValues[':nombreNormalizado'] = nombreNormalizado;
    updateParts.push('gsi1pk = :gsi1pk');
    expressionAttributeValues[':gsi1pk'] = `NOMBRE_NORMALIZADO#${nombreNormalizado}`;
  }

  if (data.categoria !== undefined) {
    updateParts.push('#categoria = :categoria');
    expressionAttributeNames['#categoria'] = 'categoria';
    expressionAttributeValues[':categoria'] = data.categoria;
    updateParts.push('gsi2pk = :gsi2pk');
    expressionAttributeValues[':gsi2pk'] = `CATEGORIA#${data.categoria}`;
  }

  if (data.estado !== undefined) {
    updateParts.push('#estado = :estado');
    expressionAttributeNames['#estado'] = 'estado';
    expressionAttributeValues[':estado'] = data.estado;
  }

  updateParts.push('#fechaActualizacion = :fechaActualizacion');
  expressionAttributeNames['#fechaActualizacion'] = 'fechaActualizacion';
  expressionAttributeValues[':fechaActualizacion'] = new Date().toISOString();

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: tableHabilidades,
      Key: { pk: pk(habilidadId), sk: sk() },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

async function cambiarEstado(habilidadId, activo) {
  const estado = activo ? 'ACTIVO' : 'INACTIVO';
  return actualizar(habilidadId, { estado });
}

async function obtenerPorNombreNormalizado(nombreNormalizado) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: tableHabilidades,
      IndexName: 'GSI1',
      KeyConditionExpression: 'gsi1pk = :gsi1pk AND begins_with(gsi1sk, :sk)',
      ExpressionAttributeValues: {
        ':gsi1pk': `NOMBRE_NORMALIZADO#${nombreNormalizado}`,
        ':sk': SK_METADATA,
      },
    })
  );
  if (!result.Items || result.Items.length === 0) return null;
  return result.Items[0];
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