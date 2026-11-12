const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} = require('../config/dynamodb');
const { tableCargos, tableColaboradores } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');
const { randomUUID } = require('node:crypto');

/**
 * Crear un cargo.
 * @param {Object} data - { cargoId, nombre, descripcion, categoria, estado }
 * @returns {Promise<Object>}
 */
async function crear(data) {
  if (typeof data.nombre !== 'string' || !data.nombre.trim()) {
    throw new ErrorApp('nombre de cargo obligatorio', 400, CODIGOS.VALIDACION);
  }
  if (data.estado !== undefined && !['ACTIVO', 'INACTIVO'].includes(data.estado)) {
    throw new ErrorApp('Estado de cargo inválido', 400, CODIGOS.VALIDACION);
  }
  const item = {
    cargoId: data.cargoId || randomUUID(),
    nombre: data.nombre.trim(),
    descripcion: data.descripcion || null,
    categoria: data.categoria || 'GENERAL',
    estado: data.estado || 'ACTIVO',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
  };

  try {
    await dynamoDb.send(new PutCommand({
      TableName: tableCargos,
      Item: item,
      ConditionExpression: 'attribute_not_exists(cargoId)',
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('Ya existe un cargo con ese identificador', 409, CODIGOS.CONFLICTO);
    }
    throw err;
  }
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
    params.KeyConditionExpression = '#estado = :estado';
    params.ExpressionAttributeNames = { '#estado': 'estado' };
    params.ExpressionAttributeValues = {
      ':estado': estado,
    };
  }

  if (lastKey) params.ExclusiveStartKey = lastKey;

  const result = await dynamoDb.send(estado ? new QueryCommand(params) : new ScanCommand(params));
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
      Key: { cargoId },
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

  if (data.estado !== undefined) {
    if (!['ACTIVO', 'INACTIVO'].includes(data.estado)) {
      throw new ErrorApp('Estado de cargo inválido', 400, CODIGOS.VALIDACION);
    }
    updateParts.push('#estado = :estado');
    expressionAttributeNames['#estado'] = 'estado';
    expressionAttributeValues[':estado'] = data.estado;
  }

  if (data.nombre !== undefined) {
    if (typeof data.nombre !== 'string' || !data.nombre.trim()) {
      throw new ErrorApp('nombre de cargo obligatorio', 400, CODIGOS.VALIDACION);
    }
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
      Key: { cargoId },
      ConditionExpression: 'attribute_exists(cargoId)',
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
  // No existe un índice por cargoId en el contrato actual de Colaboradores.
  // Recorrer páginas: una página filtrada vacía no significa ausencia de vínculos.
  let lastKey;
  do {
    const result = await dynamoDb.send(new ScanCommand({
      TableName: tableColaboradores,
      FilterExpression: '#cargo = :cargo',
      ExpressionAttributeNames: { '#cargo': 'cargoId' },
      ExpressionAttributeValues: { ':cargo': cargoId },
      ProjectionExpression: 'colaboradorId',
      ConsistentRead: true,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    if ((result.Items || []).length > 0) return true;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return false;
}

module.exports = {
  crear,
  listar,
  obtenerPorId,
  actualizar,
  cambiarEstado,
  tieneColaboradoresAsociados,
};