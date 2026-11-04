const { dynamoDb } = require('../config/dynamodb');
const { tableUsuarios } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');

const PK_PREFIX = 'USUARIO';
const SK_METADATA = 'METADATA';

function pk(usuarioId) {
  return `${PK_PREFIX}#${usuarioId}`;
}

function sk() {
  return SK_METADATA;
}

/**
 * Consultar un usuario por su usuarioId.
 * @param {string} usuarioId
 * @returns {Promise<Object|null>}
 */
async function obtenerPorId(usuarioId) {
  const result = await dynamoDb.get({
    TableName: tableUsuarios,
    Key: { pk: pk(usuarioId), sk: sk() },
  });
  return result.Item || null;
}

/**
 * Consultar un usuario por su cognitoSub (identidad de Cognito).
 * @param {string} cognitoSub
 * @returns {Promise<Object|null>}
 */
async function obtenerPorCognitoSub(cognitoSub) {
  const result = await dynamoDb.query({
    TableName: tableUsuarios,
    IndexName: 'GSI1',
    KeyConditionExpression: 'gsi1pk = :gsi1pk AND begins_with(gsi1sk, :sk)',
    ExpressionAttributeValues: {
      ':gsi1pk': `COGNITO#${cognitoSub}`,
      ':sk': SK_METADATA,
    },
  });
  if (!result.Items || result.Items.length === 0) return null;
  return result.Items[0];
}

/**
 * Listar usuarios para administración con filtros opcionales.
 * @param {Object} [filtros] - { rol?, estado?, limit?, lastKey? }
 * @returns {Promise<{ items: Array, lastKey: Object|null }>}
 */
async function listar(filtros = {}) {
  const { rol, estado, limit = 25, lastKey } = filtros;

  if (rol || estado) {
    const filterParts = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (rol) {
      filterParts.push('#rol = :rol');
      expressionAttributeNames['#rol'] = 'rol';
      expressionAttributeValues[':rol'] = rol;
    }
    if (estado) {
      filterParts.push('#estado = :estado');
      expressionAttributeNames['#estado'] = 'estado';
      expressionAttributeValues[':estado'] = estado;
    }

    const params = {
      TableName: tableUsuarios,
      FilterExpression: filterParts.join(' AND '),
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      Limit: limit,
    };

    if (lastKey) params.ExclusiveStartKey = lastKey;

    const result = await dynamoDb.scan(params);
    return {
      items: result.Items || [],
      lastKey: result.LastEvaluatedKey || null,
    };
  }

  // Sin filtros de rol/estado: usar query por GSI2 (ROL) o scan general
  const params = {
    TableName: tableUsuarios,
    Limit: limit,
  };
  if (lastKey) params.ExclusiveStartKey = lastKey;

  const result = await dynamoDb.scan(params);
  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey || null,
  };
}

/**
 * Crear el registro interno de usuario.
 * @param {Object} data - { usuarioId, cognitoSub, nombre, email, rol, estado }
 * @returns {Promise<Object>}
 */
async function crear(data) {
  const item = {
    pk: pk(data.usuarioId),
    sk: sk(),
    usuarioId: data.usuarioId,
    cognitoSub: data.cognitoSub,
    nombre: data.nombre,
    email: data.email,
    rol: data.rol || 'EMPLEADO',
    estado: data.estado || 'ACTIVO',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    gsi1pk: `COGNITO#${data.cognitoSub}`,
    gsi1sk: SK_METADATA,
    gsi2pk: `ROL#${data.rol}`,
    gsi2sk: SK_METADATA,
  };

  await dynamoDb.put({
    TableName: tableUsuarios,
    Item: item,
    ConditionExpression: 'attribute_not_exists(pk)',
  });

  return item;
}

/**
 * Actualizar datos permitidos del usuario.
 * @param {string} usuarioId
 * @param {Object} data - campos permitidos: nombre, email, rol, estado
 * @returns {Promise<Object>}
 */
async function actualizar(usuarioId, data) {
  const existente = await obtenerPorId(usuarioId);
  if (!existente) {
    throw new ErrorApp('Usuario no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  }

  const updateParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  const camposPermitidos = ['nombre', 'email', 'rol', 'estado'];
  camposPermitidos.forEach((campo) => {
    if (data[campo] !== undefined) {
      updateParts.push(`#${campo} = :${campo}`);
      expressionAttributeNames[`#${campo}`] = campo;
      expressionAttributeValues[`:${campo}`] = data[campo];
    }
  });

  if (data.rol) {
    expressionAttributeValues[':gsi2pk'] = `ROL#${data.rol}`;
    updateParts.push('gsi2pk = :gsi2pk');
  }

  updateParts.push('#fechaActualizacion = :fechaActualizacion');
  expressionAttributeNames['#fechaActualizacion'] = 'fechaActualizacion';
  expressionAttributeValues[':fechaActualizacion'] = new Date().toISOString();

  const result = await dynamoDb.update({
    TableName: tableUsuarios,
    Key: { pk: pk(usuarioId), sk: sk() },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  });

  return result.Attributes;
}

/**
 * Cambiar el rol de plataforma de un usuario.
 * @param {string} usuarioId
 * @param {string} rol - EMPLEADO | RRHH | LIDER_PROYECTO | ADMINISTRADOR
 * @returns {Promise<Object>}
 */
async function cambiarRol(usuarioId, rol) {
  return actualizar(usuarioId, { rol });
}

/**
 * Activar o desactivar una cuenta.
 * @param {string} usuarioId
 * @param {boolean} activo
 * @returns {Promise<Object>}
 */
async function cambiarEstado(usuarioId, activo) {
  const estado = activo ? 'ACTIVO' : 'INACTIVO';
  return actualizar(usuarioId, { estado });
}

module.exports = {
  obtenerPorId,
  obtenerPorCognitoSub,
  listar,
  crear,
  actualizar,
  cambiarRol,
  cambiarEstado,
};