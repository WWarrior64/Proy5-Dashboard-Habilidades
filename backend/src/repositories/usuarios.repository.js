const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('../config/dynamodb');
const { tableUsuarios } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');

/**
 * Consultar un usuario por su usuarioId.
 * @param {string} usuarioId
 * @returns {Promise<Object|null>}
 */
async function obtenerPorId(usuarioId) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: tableUsuarios,
      Key: { usuarioId },
    })
  );
  return result.Item || null;
}

/**
 * Consultar un usuario por su cognitoSub (identidad de Cognito).
 * @param {string} cognitoSub
 * @returns {Promise<Object|null>}
 */
async function obtenerPorCognitoSub(cognitoSub) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: tableUsuarios,
      IndexName: 'GSI1',
      KeyConditionExpression: '#identity = :identity',
      ExpressionAttributeNames: { '#identity': 'cognitoSub' },
      ExpressionAttributeValues: { ':identity': cognitoSub },
    })
  );
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

    const result = await dynamoDb.send(new ScanCommand(params));
    return {
      items: result.Items || [],
      lastKey: result.LastEvaluatedKey || null,
    };
  }

  const params = {
    TableName: tableUsuarios,
    Limit: limit,
  };
  if (lastKey) params.ExclusiveStartKey = lastKey;

  const result = await dynamoDb.send(new ScanCommand(params));
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
    usuarioId: data.usuarioId,
    cognitoSub: data.cognitoSub,
    nombre: data.nombre,
    email: data.email,
    correo: (data.correo || data.email).trim().toLowerCase(),
    nombreCompleto: data.nombreCompleto || data.nombre,
    rol: data.rol || 'EMPLEADO',
    estado: data.estado || 'ACTIVO',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
  };

  // Comprobación de perfiles vinculados; rechaza reutilizar la misma identidad.
  const yaVinculado = await obtenerPorCognitoSub(item.cognitoSub);
  if (yaVinculado) {
    throw new ErrorApp('La cuenta Cognito ya está vinculada a un usuario interno', 409, CODIGOS.CONFLICTO);
  }
  const correoEnUso = await dynamoDb.send(new QueryCommand({
    TableName: tableUsuarios,
    IndexName: 'GSI2',
    KeyConditionExpression: '#correo = :correo',
    ExpressionAttributeNames: { '#correo': 'correo' },
    ExpressionAttributeValues: { ':correo': item.correo },
    Limit: 1,
  }));
  if (correoEnUso.Items?.length) {
    throw new ErrorApp('Ya existe un usuario interno con ese correo', 409, CODIGOS.CONFLICTO);
  }

  await dynamoDb.send(
    new PutCommand({
      TableName: tableUsuarios,
      Item: item,
      ConditionExpression: 'attribute_not_exists(usuarioId)',
    })
  );

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

  data = { ...data };
  if (data.email !== undefined) data.correo = data.email.trim().toLowerCase();
  if (data.nombre !== undefined) data.nombreCompleto = data.nombre;
  const camposPermitidos = ['nombre', 'email', 'nombreCompleto', 'correo', 'rol', 'estado'];
  camposPermitidos.forEach((campo) => {
    if (data[campo] !== undefined) {
      updateParts.push(`#${campo} = :${campo}`);
      expressionAttributeNames[`#${campo}`] = campo;
      expressionAttributeValues[`:${campo}`] = data[campo];
    }
  });


  updateParts.push('#fechaActualizacion = :fechaActualizacion');
  expressionAttributeNames['#fechaActualizacion'] = 'fechaActualizacion';
  expressionAttributeValues[':fechaActualizacion'] = new Date().toISOString();

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: tableUsuarios,
      Key: { usuarioId },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

/** Registra el último inicio de sesión confirmado de un usuario activo. */
async function registrarUltimoAcceso(usuarioId) {
  const fecha = new Date().toISOString();
  try {
    const resultado = await dynamoDb.send(new UpdateCommand({
      TableName: tableUsuarios,
      Key: { usuarioId },
      UpdateExpression: 'SET #ultimoAcceso = :fecha',
      ConditionExpression: 'attribute_exists(usuarioId) AND #estado = :activo',
      ExpressionAttributeNames: {
        '#ultimoAcceso': 'ultimoAcceso',
        '#estado': 'estado',
      },
      ExpressionAttributeValues: { ':fecha': fecha, ':activo': 'ACTIVO' },
      ReturnValues: 'ALL_NEW',
    }));
    return resultado.Attributes;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('Usuario inexistente o inactivo', 403, CODIGOS.PROHIBIDO);
    }
    throw err;
  }
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
  registrarUltimoAcceso,
  cambiarRol,
  cambiarEstado,
};