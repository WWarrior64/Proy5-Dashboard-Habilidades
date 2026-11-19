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
const { tableUsuarios, tableColaboradores, tableAsignaciones } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');

const CONTROL_ADMIN_ID = 'CONTROL#ADMINISTRADORES_ACTIVOS';
const MENSAJE_ULTIMO_ADMIN = 'Debe existir al menos otro administrador activo antes de desactivar la cuenta o cambiar su rol';

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
    FilterExpression: 'attribute_not_exists(#control)',
    ExpressionAttributeNames: { '#control': 'tipoRegistroControl' },
  };
  if (lastKey) params.ExclusiveStartKey = lastKey;

  const result = await dynamoDb.send(new ScanCommand(params));
  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey || null,
  };
}

/**
 * Control transaccional del número de administradores activos.
 * Se inicializa con los usuarios históricos mediante lecturas consistentes y
 * se actualiza en la misma transacción que los cambios de rol o estado.
 */
async function asegurarControlAdministradores() {
  const clave = { usuarioId: CONTROL_ADMIN_ID };
  const existente = await dynamoDb.send(new GetCommand({
    TableName: tableUsuarios, Key: clave, ConsistentRead: true,
  }));
  if (existente.Item) {
    if (!Number.isInteger(existente.Item.totalActivos) || existente.Item.totalActivos < 0) {
      throw new ErrorApp('El control de administradores necesita revisión', 409, CODIGOS.CONFLICTO);
    }
    return existente.Item.totalActivos;
  }

  let totalActivos = 0;
  let cursor;
  do {
    const pagina = await dynamoDb.send(new ScanCommand({
      TableName: tableUsuarios,
      ConsistentRead: true,
      FilterExpression: '#rol = :rol AND #estado = :estado',
      ExpressionAttributeNames: { '#rol': 'rol', '#estado': 'estado' },
      ExpressionAttributeValues: { ':rol': 'ADMINISTRADOR', ':estado': 'ACTIVO' },
      ...(cursor && { ExclusiveStartKey: cursor }),
    }));
    totalActivos += (pagina.Items || []).length;
    cursor = pagina.LastEvaluatedKey;
  } while (cursor);

  try {
    await dynamoDb.send(new PutCommand({
      TableName: tableUsuarios,
      Item: { ...clave, tipoRegistroControl: 'ADMINISTRADORES_ACTIVOS', totalActivos },
      ConditionExpression: 'attribute_not_exists(usuarioId)',
    }));
    return totalActivos;
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    const guardado = await dynamoDb.send(new GetCommand({
      TableName: tableUsuarios, Key: clave, ConsistentRead: true,
    }));
    if (!Number.isInteger(guardado.Item?.totalActivos)) {
      throw new ErrorApp('El control de administradores necesita revisión', 409, CODIGOS.CONFLICTO);
    }
    return guardado.Item.totalActivos;
  }
}

async function ajusteAdministradores(delta) {
  const actuales = await asegurarControlAdministradores();
  if (delta < 0 && actuales <= 1) {
    throw new ErrorApp(MENSAJE_ULTIMO_ADMIN, 409, CODIGOS.CONFLICTO);
  }
  return { Update: {
    TableName: tableUsuarios,
    Key: { usuarioId: CONTROL_ADMIN_ID },
    UpdateExpression: 'ADD #total :delta',
    ConditionExpression: '#total >= :minimo',
    ExpressionAttributeNames: { '#total': 'totalActivos' },
    ExpressionAttributeValues: { ':delta': delta, ':minimo': delta < 0 ? 2 : 0 },
  } };
}

function conflictoCambioAdministrador(err) {
  if (['TransactionCanceledException', 'ConditionalCheckFailedException', 'TransactionConflictException'].includes(err.name)) {
    throw new ErrorApp('No se pudo confirmar el cambio de administradores; debe permanecer al menos uno activo. Recargue e intente de nuevo', 409, CODIGOS.CONFLICTO);
  }
  throw err;
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

  const insertarUsuario = {
    TableName: tableUsuarios,
    Item: item,
    ConditionExpression: 'attribute_not_exists(usuarioId)',
  };
  if (item.rol === 'ADMINISTRADOR' && item.estado === 'ACTIVO') {
    const contador = await ajusteAdministradores(1);
    try {
      await dynamoDb.send(new TransactWriteCommand({
        TransactItems: [{ Put: insertarUsuario }, contador],
      }));
    } catch (err) {
      conflictoCambioAdministrador(err);
    }
  } else {
    await dynamoDb.send(new PutCommand(insertarUsuario));
  }

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
  if (data.estado !== undefined) {
    throw new ErrorApp('Utilice el cambio de estado transaccional para desactivar o activar cuentas', 400, CODIGOS.VALIDACION);
  }
  if (data.rol !== undefined) {
    throw new ErrorApp('Utilice el cambio de rol transaccional para modificar administradores', 400, CODIGOS.VALIDACION);
  }
  if (data.email !== undefined) data.correo = data.email.trim().toLowerCase();
  if (data.nombre !== undefined) data.nombreCompleto = data.nombre;
  const camposPermitidos = ['nombre', 'email', 'nombreCompleto', 'correo'];
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
  const usuario = await obtenerPorId(usuarioId);
  if (!usuario) throw new ErrorApp('Usuario no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  if (usuario.rol === rol) return usuario;

  const ahora = new Date().toISOString();
  const actualizarRol = {
    TableName: tableUsuarios,
    Key: { usuarioId },
    UpdateExpression: 'SET #rol = :nuevo, #fecha = :fecha',
    ConditionExpression: 'attribute_exists(usuarioId) AND #rol = :anterior AND #estado = :estadoAnterior',
    ExpressionAttributeNames: { '#rol': 'rol', '#estado': 'estado', '#fecha': 'fechaActualizacion' },
    ExpressionAttributeValues: {
      ':nuevo': rol, ':anterior': usuario.rol, ':estadoAnterior': usuario.estado, ':fecha': ahora,
    },
  };

  const delta = usuario.estado === 'ACTIVO'
    ? (rol === 'ADMINISTRADOR' ? 1 : 0) - (usuario.rol === 'ADMINISTRADOR' ? 1 : 0)
    : 0;
  if (delta !== 0) {
    const contador = await ajusteAdministradores(delta);
    try {
      await dynamoDb.send(new TransactWriteCommand({
        TransactItems: [{ Update: actualizarRol }, contador],
      }));
    } catch (err) {
      conflictoCambioAdministrador(err);
    }
    return { ...usuario, rol, fechaActualizacion: ahora };
  }
  try {
    const resultado = await dynamoDb.send(new UpdateCommand({
      ...actualizarRol, ReturnValues: 'ALL_NEW',
    }));
    return resultado.Attributes;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('La cuenta cambió; recargue antes de modificar el rol', 409, CODIGOS.CONFLICTO);
    }
    throw err;
  }
}

/**
 * Activar o desactivar una cuenta.
 * @param {string} usuarioId
 * @param {boolean} activo
 * @returns {Promise<Object>}
 */
async function obtenerColaboradorVinculado(usuarioId) {
  const reserva = await dynamoDb.send(new GetCommand({
    TableName: tableColaboradores, Key: { colaboradorId: 'USUARIO#' + usuarioId }, ConsistentRead: true,
  }));
  if (reserva.Item?.propietarioColaboradorId) {
    const vinculado = await dynamoDb.send(new GetCommand({
      TableName: tableColaboradores,
      Key: { colaboradorId: reserva.Item.propietarioColaboradorId }, ConsistentRead: true,
    }));
    if (!vinculado.Item || vinculado.Item.usuarioId !== usuarioId) {
      throw new ErrorApp('La reserva del perfil no corresponde al usuario; requiere reconciliación', 409, CODIGOS.CONFLICTO);
    }
    return vinculado.Item;
  }
  if (reserva.Item) {
    throw new ErrorApp('La reserva del perfil está incompleta; requiere reconciliación', 409, CODIGOS.CONFLICTO);
  }
  // El GSI1 es eventualmente consistente y podría ocultar un perfil histórico.
  // La lectura fuerte de la tabla base, paginada hasta el final, evita desactivar
  // únicamente la cuenta cuando ya existe un colaborador sin reserva USUARIO#.
  const historicos = [];
  let cursor;
  do {
    const pagina = await dynamoDb.send(new ScanCommand({
      TableName: tableColaboradores,
      ConsistentRead: true,
      FilterExpression: '#usuario = :usuario',
      ExpressionAttributeNames: { '#usuario': 'usuarioId' },
      ExpressionAttributeValues: { ':usuario': usuarioId },
      ...(cursor && { ExclusiveStartKey: cursor }),
    }));
    historicos.push(...(pagina.Items || []));
    if (historicos.length > 1) {
      throw new ErrorApp('Existen perfiles duplicados; revise la reconciliación antes de cambiar la cuenta', 409, CODIGOS.CONFLICTO);
    }
    cursor = pagina.LastEvaluatedKey;
  } while (cursor);
  return historicos[0] || null;
}

async function cambiarEstado(usuarioId, activo) {
  if (typeof activo !== 'boolean') {
    throw new ErrorApp('activo debe ser booleano', 400, CODIGOS.VALIDACION);
  }
  const usuario = await obtenerPorId(usuarioId);
  if (!usuario) throw new ErrorApp('Usuario no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  const estado = activo ? 'ACTIVO' : 'INACTIVO';
  if (usuario.estado === estado) return usuario;
  const contador = usuario.rol === 'ADMINISTRADOR'
    ? await ajusteAdministradores(activo ? 1 : -1) : null;
  const ahora = new Date().toISOString();
  const perfil = await obtenerColaboradorVinculado(usuarioId);
  const actualizarUsuario = {
    TableName: tableUsuarios,
    Key: { usuarioId },
    UpdateExpression: 'SET #estado = :nuevo, #fecha = :fecha',
    ConditionExpression: 'attribute_exists(usuarioId) AND #estado = :anterior AND #rol = :rolAnterior',
    ExpressionAttributeNames: { '#estado': 'estado', '#rol': 'rol', '#fecha': 'fechaActualizacion' },
    ExpressionAttributeValues: {
      ':nuevo': estado, ':anterior': usuario.estado, ':rolAnterior': usuario.rol, ':fecha': ahora,
    },
  };
  if (activo || !perfil) {
    try {
      if (contador) {
        await dynamoDb.send(new TransactWriteCommand({
          TransactItems: [{ Update: actualizarUsuario }, contador],
        }));
        return { ...usuario, estado, fechaActualizacion: ahora };
      }
      const resultado = await dynamoDb.send(new UpdateCommand({
        ...actualizarUsuario, ReturnValues: 'ALL_NEW',
      }));
      return resultado.Attributes;
    } catch (err) {
      if (contador) conflictoCambioAdministrador(err);
      if (err.name === 'ConditionalCheckFailedException') {
        throw new ErrorApp('La cuenta cambió de estado; recargue antes de reintentar', 409, CODIGOS.CONFLICTO);
      }
      throw err;
    }
  }
  if (perfil.dedicacionReservada !== 0) {
    throw new ErrorApp('No se puede desactivar la cuenta: revise la dedicación y finalice sus asignaciones activas', 409, CODIGOS.CONFLICTO);
  }
  // Comprobación adicional de historial; la condición de reserva se valida de nuevo en la transacción.
  const asignaciones = await dynamoDb.send(new QueryCommand({
    TableName: tableAsignaciones, IndexName: 'GSI1',
    KeyConditionExpression: '#colaborador = :colaborador AND begins_with(#clave, :prefijo)',
    ExpressionAttributeNames: { '#colaborador': 'colaboradorId', '#clave': 'colaboradorFechaKey' },
    ExpressionAttributeValues: { ':colaborador': perfil.colaboradorId, ':prefijo': 'ACTIVA#' },
    Limit: 1,
  }));
  if (asignaciones.Items?.length) {
    throw new ErrorApp('Finalice o desvincule las asignaciones activas antes de desactivar la cuenta', 409, CODIGOS.CONFLICTO);
  }
  const cambioPerfil = perfil.estado === 'ACTIVO'
    ? ', #baja = :fecha' : '';
  try {
    await dynamoDb.send(new TransactWriteCommand({ TransactItems: [
      { Update: actualizarUsuario },
      ...(contador ? [contador] : []),
      { Update: {
        TableName: tableColaboradores, Key: { colaboradorId: perfil.colaboradorId },
        UpdateExpression: 'SET #estado = :inactivo, #fecha = :fecha' + cambioPerfil,
        ConditionExpression: 'attribute_exists(colaboradorId) AND #estado = :anterior AND dedicacionReservada = :cero AND usuarioId = :usuario',
        ExpressionAttributeNames: {
          '#estado': 'estado', '#fecha': 'fechaActualizacion',
          ...(cambioPerfil && { '#baja': 'fechaBaja' }),
        },
        ExpressionAttributeValues: {
          ':inactivo': 'INACTIVO', ':anterior': perfil.estado,
          ':fecha': ahora, ':cero': 0, ':usuario': usuarioId,
        },
      } },
    ] }));
  } catch (err) {
    if (contador) conflictoCambioAdministrador(err);
    if (['TransactionCanceledException', 'ConditionalCheckFailedException', 'TransactionConflictException'].includes(err.name)) {
      throw new ErrorApp('La cuenta o las asignaciones cambiaron; recargue antes de desactivar', 409, CODIGOS.CONFLICTO);
    }
    throw err;
  }
  return { ...usuario, estado, fechaActualizacion: ahora };
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