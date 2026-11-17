const {
  dynamoDb,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} = require('../config/dynamodb');
const { tableColaboradores, tableUsuarios, tableAsignaciones } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');
const { randomUUID } = require('node:crypto');
const usuariosRepository = require('./usuarios.repository');
const cargosRepository = require('./cargos.repository');
const { recorrerPaginas } = require('../utils/paginacion');

async function obtenerPerfilPorCuentaConsistente(usuarioId) {
  const reserva = await dynamoDb.send(new GetCommand({
    TableName: tableColaboradores,
    Key: { colaboradorId: 'USUARIO#' + usuarioId },
    ConsistentRead: true,
  }));
  if (reserva.Item) {
    if (!reserva.Item.propietarioColaboradorId) {
      throw new ErrorApp('Reserva de perfil incompleta; debe reconciliarse', 409, CODIGOS.CONFLICTO);
    }
    const perfil = await dynamoDb.send(new GetCommand({
      TableName: tableColaboradores,
      Key: { colaboradorId: reserva.Item.propietarioColaboradorId },
      ConsistentRead: true,
    }));
    if (!perfil.Item || perfil.Item.usuarioId !== usuarioId) {
      throw new ErrorApp('Reserva de perfil inconsistente; debe reconciliarse', 409, CODIGOS.CONFLICTO);
    }
    return perfil.Item;
  }
  // Fallback exclusivo de perfiles históricos sin reserva. El GSI1 no permite
  // confirmar unicidad porque sus lecturas son eventualmente consistentes.
  const encontrados = [];
  await recorrerPaginas(cursor => dynamoDb.send(new ScanCommand({
    TableName: tableColaboradores,
    ConsistentRead: true,
    FilterExpression: '#usuario = :usuario',
    ExpressionAttributeNames: { '#usuario': 'usuarioId' },
    ExpressionAttributeValues: { ':usuario': usuarioId },
    ...(cursor && { ExclusiveStartKey: cursor }),
  })), items => {
    encontrados.push(...items);
    if (encontrados.length > 1) {
      throw new ErrorApp('Un usuario tiene múltiples perfiles históricos; requiere reconciliación', 409, CODIGOS.CONFLICTO);
    }
  });
  return encontrados[0] || null;
}

async function validarReglas(data, colaboradorIdExcluir = null) {
  const usuario = await usuariosRepository.obtenerPorId(data.usuarioId);
  if (!usuario) {
    throw new ErrorApp('El usuarioId no corresponde a un usuario existente', 400, CODIGOS.VALIDACION);
  }
  if (usuario.estado !== 'ACTIVO') {
    throw new ErrorApp('El usuario debe estar activo para crear un colaborador', 400, CODIGOS.VALIDACION);
  }

  const cargo = await cargosRepository.obtenerPorId(data.cargoId);
  if (!cargo) {
    throw new ErrorApp('El cargoId no corresponde a un cargo existente', 400, CODIGOS.VALIDACION);
  }
  if (cargo.estado !== 'ACTIVO') {
    throw new ErrorApp('No se puede asignar un colaborador a un cargo inactivo', 400, CODIGOS.VALIDACION);
  }

  const existentePorUsuario = await obtenerPerfilPorCuentaConsistente(data.usuarioId);
  if (existentePorUsuario && existentePorUsuario.colaboradorId !== colaboradorIdExcluir) {
    throw new ErrorApp('El usuario ya tiene un perfil de colaborador asociado', 409, CODIGOS.CONFLICTO);
  }
  return usuario;
}

async function crear(data) {
  const usuario = await validarReglas(data);
  const nombre = usuario?.nombre || data.nombre || data.rolProfesional;
  if (data.colaboradorId?.startsWith('USUARIO#')) {
    throw new ErrorApp('Identificador de colaborador reservado', 400, CODIGOS.VALIDACION);
  }

  const item = {
    colaboradorId: data.colaboradorId || randomUUID(),
    usuarioId: data.usuarioId,
    cargoId: data.cargoId,
    rolProfesional: data.rolProfesional,
    nombre,
    'rolProfesional#nombre': `${data.rolProfesional}#${nombre}`,
    dedicacionReservada: 0,
    habilidadesRevision: 0,
    disponibilidad: data.disponibilidad || 'DISPONIBLE',
    estado: data.estado || 'ACTIVO',
    fechaAlta: new Date().toISOString(),
    fechaBaja: null,
    fechaActualizacion: new Date().toISOString(),
    observaciones: data.observaciones || null,
  };

  try {
    // Guardar la reserva de usuario en la misma transacción impide que dos
    // solicitudes simultáneas creen perfiles para una misma cuenta.
    await dynamoDb.send(new TransactWriteCommand({ TransactItems: [
      { ConditionCheck: {
        TableName: tableUsuarios,
        Key: { usuarioId: data.usuarioId },
        ConditionExpression: '#estado = :activo',
        ExpressionAttributeNames: { '#estado': 'estado' },
        ExpressionAttributeValues: { ':activo': 'ACTIVO' },
      } },
      { Put: { TableName: tableColaboradores, Item: item,
        ConditionExpression: 'attribute_not_exists(colaboradorId)' } },
      { Put: { TableName: tableColaboradores,
        Item: { colaboradorId: `USUARIO#${data.usuarioId}`, propietarioColaboradorId: item.colaboradorId },
        ConditionExpression: 'attribute_not_exists(colaboradorId)' } },
    ] }));
  } catch (err) {
    if (['ConditionalCheckFailedException', 'TransactionCanceledException'].includes(err.name)) {
      throw new ErrorApp('Ya existe un colaborador con ese identificador o usuario', 409, CODIGOS.CONFLICTO);
    }
    throw err;
  }
  return item;
}

async function listar(filtros = {}) {
  const { estado, cargoId, rolProfesional, limit = 25, lastKey } = filtros;

  // Los ítems USUARIO# son reservas de unicidad, no perfiles visibles.
  const filterParts = ['attribute_exists(#usuarioIdReal)'];
  const expressionAttributeValues = {};
  const expressionAttributeNames = { '#usuarioIdReal': 'usuarioId' };

  if (estado) {
    filterParts.push('#estado = :estado');
    expressionAttributeNames['#estado'] = 'estado';
    expressionAttributeValues[':estado'] = estado;
  }
  if (cargoId) {
    filterParts.push('#cargoId = :cargoId');
    expressionAttributeNames['#cargoId'] = 'cargoId';
    expressionAttributeValues[':cargoId'] = cargoId;
  }
  if (rolProfesional) {
    filterParts.push('#rolProfesional = :rolProfesional');
    expressionAttributeNames['#rolProfesional'] = 'rolProfesional';
    expressionAttributeValues[':rolProfesional'] = rolProfesional;
  }

  const params = {
    TableName: tableColaboradores,
    Limit: limit,
  };

  if (filterParts.length > 0) {
    params.FilterExpression = filterParts.join(' AND ');
    if (Object.keys(expressionAttributeValues).length > 0) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  if (lastKey) params.ExclusiveStartKey = lastKey;

  const result = await dynamoDb.send(new ScanCommand(params));
  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey || null,
  };
}

async function obtenerPorId(colaboradorId) {
  if (String(colaboradorId).startsWith('USUARIO#')) return null;
  const result = await dynamoDb.send(new GetCommand({
    TableName: tableColaboradores,
    Key: { colaboradorId },
  }));
  return result.Item || null;
}

async function obtenerPorUsuarioId(usuarioId) {
  // Las altas nuevas guardan una reserva única en la tabla base. Consultarla
  // consistentemente evita depender de la propagación eventual del GSI.
  const reserva = await dynamoDb.send(new GetCommand({
    TableName: tableColaboradores,
    Key: { colaboradorId: `USUARIO#${usuarioId}` },
    ConsistentRead: true,
  }));
  if (reserva.Item?.propietarioColaboradorId) {
    return obtenerPorId(reserva.Item.propietarioColaboradorId);
  }
  // Compatibilidad con perfiles históricos que todavía no tienen reserva.
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: tableColaboradores,
      IndexName: 'GSI1',
      KeyConditionExpression: '#identity = :identity',
      ExpressionAttributeNames: { '#identity': 'usuarioId' },
      ExpressionAttributeValues: { ':identity': usuarioId },
    })
  );
  if (!result.Items || result.Items.length === 0) return null;
  return result.Items[0];
}

async function actualizar(colaboradorId, data) {
  if (data.estado !== undefined && !['ACTIVO', 'INACTIVO'].includes(data.estado)) {
    throw new ErrorApp('Estado de colaborador inválido', 400, CODIGOS.VALIDACION);
  }
  if (data.rolProfesional !== undefined &&
      (typeof data.rolProfesional !== 'string' || !data.rolProfesional.trim())) {
    throw new ErrorApp('rolProfesional debe ser un texto no vacío', 400, CODIGOS.VALIDACION);
  }
  const existente = await obtenerPorId(colaboradorId);
  if (!existente) {
    throw new ErrorApp('Colaborador no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  }

  if (data.estado === 'INACTIVO' && existente.estado !== 'INACTIVO') {
    if (existente.dedicacionReservada !== 0) {
      throw new ErrorApp('Debe finalizar las asignaciones y reconciliar la dedicación antes de dar de baja', 409, CODIGOS.CONFLICTO);
    }
    const activas = await dynamoDb.send(new QueryCommand({
      TableName: tableAsignaciones, IndexName: 'GSI1',
      KeyConditionExpression: '#colaborador = :colaborador AND begins_with(#clave, :activa)',
      ExpressionAttributeNames: { '#colaborador': 'colaboradorId', '#clave': 'colaboradorFechaKey' },
      ExpressionAttributeValues: { ':colaborador': colaboradorId, ':activa': 'ACTIVA#' },
      Limit: 1,
    }));
    if (activas.Items?.length) {
      throw new ErrorApp('Finalice o desvincule las asignaciones activas antes de dar de baja', 409, CODIGOS.CONFLICTO);
    }
  }

  if (data.estado === 'ACTIVO' && existente.estado === 'INACTIVO') {
    const cuenta = await usuariosRepository.obtenerPorId(existente.usuarioId);
    if (!cuenta || cuenta.estado !== 'ACTIVO') {
      throw new ErrorApp('La cuenta del usuario debe estar activa para reincorporar al colaborador', 409, CODIGOS.CONFLICTO);
    }
  }

  if (data.cargoId && data.cargoId !== existente.cargoId) {
    const cargo = await cargosRepository.obtenerPorId(data.cargoId);
    if (!cargo) {
      throw new ErrorApp('El cargoId no corresponde a un cargo existente', 400, CODIGOS.VALIDACION);
    }
    if (cargo.estado !== 'ACTIVO') {
      throw new ErrorApp('No se puede asignar un colaborador a un cargo inactivo', 400, CODIGOS.VALIDACION);
    }
  }

  const updateParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  const camposPermitidos = ['cargoId', 'rolProfesional', 'estado', 'observaciones'];
  camposPermitidos.forEach((campo) => {
    if (data[campo] !== undefined) {
      updateParts.push(`#${campo} = :${campo}`);
      expressionAttributeNames[`#${campo}`] = campo;
      expressionAttributeValues[`:${campo}`] = data[campo];
    }
  });

  if (data.rolProfesional !== undefined) {
    updateParts.push('#rolNombre = :rolNombre');
    expressionAttributeNames['#rolNombre'] = 'rolProfesional#nombre';
    expressionAttributeValues[':rolNombre'] = `${data.rolProfesional}#${existente.nombre || data.rolProfesional}`;
  }

  if (data.estado === 'INACTIVO' && existente.estado !== 'INACTIVO') {
    updateParts.push('#fechaBaja = :fechaBaja');
    expressionAttributeNames['#fechaBaja'] = 'fechaBaja';
    expressionAttributeValues[':fechaBaja'] = new Date().toISOString();
  }
  if (data.estado === 'ACTIVO' && existente.estado === 'INACTIVO') {
    updateParts.push('#fechaReincorporacion = :fechaReincorporacion');
    expressionAttributeNames['#fechaReincorporacion'] = 'fechaReincorporacion';
    expressionAttributeValues[':fechaReincorporacion'] = new Date().toISOString();
    if (existente.fechaBaja) {
      updateParts.push('#ultimaFechaBaja = :ultimaFechaBaja');
      expressionAttributeNames['#ultimaFechaBaja'] = 'ultimaFechaBaja';
      expressionAttributeValues[':ultimaFechaBaja'] = existente.fechaBaja;
    }
    updateParts.push('#fechaBaja = :fechaBaja');
    expressionAttributeNames['#fechaBaja'] = 'fechaBaja';
    expressionAttributeValues[':fechaBaja'] = null;
  }

  updateParts.push('#fechaActualizacion = :fechaActualizacion');
  expressionAttributeNames['#fechaActualizacion'] = 'fechaActualizacion';
  expressionAttributeValues[':fechaActualizacion'] = new Date().toISOString();

  const parametros = {
    TableName: tableColaboradores,
    Key: { colaboradorId },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ConditionExpression: 'attribute_exists(colaboradorId)' +
      (data.estado !== undefined ? ' AND #estado = :estadoAnterior' : '') +
      (data.estado === 'INACTIVO' ? ' AND dedicacionReservada = :cero' : ''),
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  };
  if (data.estado !== undefined) expressionAttributeValues[':estadoAnterior'] = existente.estado;
  if (data.estado === 'INACTIVO') expressionAttributeValues[':cero'] = 0;

  try {
    if (data.estado === 'ACTIVO') {
      // Evita reincorporar un perfil mientras otra operación desactiva su cuenta.
      await dynamoDb.send(new TransactWriteCommand({ TransactItems: [
        { ConditionCheck: {
          TableName: tableUsuarios, Key: { usuarioId: existente.usuarioId },
          ConditionExpression: '#estado = :activo',
          ExpressionAttributeNames: { '#estado': 'estado' },
          ExpressionAttributeValues: { ':activo': 'ACTIVO' },
        } },
        { Update: parametros },
      ] }));
      return {
        ...existente, ...data, fechaActualizacion: expressionAttributeValues[':fechaActualizacion'],
        ...(existente.estado === 'INACTIVO' && {
          fechaReincorporacion: expressionAttributeValues[':fechaReincorporacion'],
          ultimaFechaBaja: existente.fechaBaja || existente.ultimaFechaBaja,
          fechaBaja: null,
        }),
      };
    }
    const result = await dynamoDb.send(new UpdateCommand({ ...parametros, ReturnValues: 'ALL_NEW' }));
    return result.Attributes;
  } catch (err) {
    if (['ConditionalCheckFailedException', 'TransactionCanceledException', 'TransactionConflictException'].includes(err.name)) {
      throw new ErrorApp('El perfil, su cuenta o la dedicación cambiaron; recargue antes de reintentar', 409, CODIGOS.CONFLICTO);
    }
    throw err;
  }
}

async function darBaja(colaboradorId) {
  return actualizar(colaboradorId, { estado: 'INACTIVO' });
}

module.exports = {
  crear,
  listar,
  obtenerPorId,
  obtenerPorUsuarioId,
  actualizar,
  darBaja,
};