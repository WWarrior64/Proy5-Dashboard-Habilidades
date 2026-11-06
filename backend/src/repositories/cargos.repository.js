const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('../config/dynamodb');
const { tableCargos, tableColaboradores } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');

const PK_PREFIX = 'CARGO';
const SK_METADATA = 'METADATA';

function pk(cargoId) {
  return `${PK_PREFIX}#${cargoId}`;
}

function sk() {
  return SK_METADATA;
}

/**
 * Crear un cargo.
 * @param {Object} data - { cargoId, nombre, descripcion, categoria, estado }
 * @returns {Promise<Object>}
 */
async function crear(data) {
  const item = {
    pk: pk(data.cargoId),
    sk: sk(),
    cargoId: data.cargoId,
    nombre: data.nombre.trim(),
    descripcion: data.descripcion || null,
    categoria: data.categoria || 'GENERAL',
    estado: data.estado || 'ACTIVO',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    gsi1pk: `ESTADO#${data.estado || 'ACTIVO'}`,
    gsi1sk: SK_METADATA,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: tableCargos,
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk)',
    })
  );

  return item;
}

/**
 * Listar cargos con filtro opcional por estado.
 * @param {Object} [filtros] - { estado?, limit?, lastKey? }
 * @returns {Promise<{ items: Array, lastKey: Object|null }>}
 */
async function listar(filtros = {}) {
  const { estado, limit = 25, lastKey } = filtros;

  const params = {
    TableName: tableCargos,
    Limit: limit,
  };

  if (estado) {
    params.IndexName = 'GSI1';
    params.KeyConditionExpression = 'gsi1pk = :gsi1pk AND begins_with(gsi1sk, :sk)';
    params.ExpressionAttributeValues = {
      ':gsi1pk': `ESTADO#${estado}`,
      ':sk': SK_METADATA,
    };
  }

  if (lastKey) params.ExclusiveStartKey = lastKey;

  const result = await dynamoDb.send(new QueryCommand(params));
  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey || null,
  };
}

/**
 * Consultar un cargo por su ID.
 * @param {string} cargoId
 * @returns {Promise<Object|null>}
 */
async function obtenerPorId(cargoId) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: tableCargos,
      Key: { pk: pk(cargoId), sk: sk() },
    })
  );
  return result.Item || null;
}

/**
 * Modificar nombre, descripción y categoría de un cargo.
 * @param {string} cargoId
 * @param {Object} data - { nombre?, descripcion?, categoria? }
 * @returns {Promise<Object>}
 */
async function actualizar(cargoId, data) {
  const existente = await obtenerPorId(cargoId);
  if (!existente) {
    throw new ErrorApp('Cargo no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  }

  const updateParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  if (data.nombre !== undefined) {
    updateParts.push('#nombre = :nombre');
    expressionAttributeNames['#nombre'] = 'nombre';
    expressionAttributeValues[':nombre'] = data.nombre.trim();
  }
  if (data.descripcion !== undefined) {
    updateParts.push('#descripcion = :descripcion');
    expressionAttributeNames['#descripcion'] = 'descripcion';
    expressionAttributeValues[':descripcion'] = data.descripcion;
  }
  if (data.categoria !== undefined) {
    updateParts.push('#categoria = :categoria');
    expressionAttributeNames['#categoria'] = 'categoria';
    expressionAttributeValues[':categoria'] = data.categoria;
  }

  updateParts.push('#fechaActualizacion = :fechaActualizacion');
  expressionAttributeNames['#fechaActualizacion'] = 'fechaActualizacion';
  expressionAttributeValues[':fechaActualizacion'] = new Date().toISOString();

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: tableCargos,
      Key: { pk: pk(cargoId), sk: sk() },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

/**
 * Desactivar o reactivar un cargo.
 * No permite desactivar si hay colaboradores asociados (verificar en service/handler).
 * @param {string} cargoId
 * @param {boolean} activo
 * @returns {Promise<Object>}
 */
async function cambiarEstado(cargoId, activo) {
  const estado = activo ? 'ACTIVO' : 'INACTIVO';
  return actualizar(cargoId, { estado });
}

/**
 * Verificar si existen colaboradores asociados a un cargo.
 * @param {string} cargoId
 * @returns {Promise<boolean>}
 */
async function tieneColaboradoresAsociados(cargoId) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: tableColaboradores,
      IndexName: 'GSI2',
      KeyConditionExpression: 'gsi2pk = :gsi2pk AND begins_with(gsi2sk, :sk)',
      ExpressionAttributeValues: {
        ':gsi2pk': `CARGO#${cargoId}`,
        ':sk': SK_METADATA,
      },
      Limit: 1,
    })
  );
  return (result.Items || []).length > 0;
}

module.exports = {
  crear,
  listar,
  obtenerPorId,
  actualizar,
  cambiarEstado,
  tieneColaboradoresAsociados,
};