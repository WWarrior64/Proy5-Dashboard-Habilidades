const { dynamoDb } = require('../config/dynamodb');
const { tableColaboradores, tableUsuarios, tableCargos } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');
const usuariosRepository = require('./usuarios.repository');
const cargosRepository = require('./cargos.repository');

const PK_PREFIX = 'COLABORADOR';
const SK_METADATA = 'METADATA';

function pk(colaboradorId) {
  return `${PK_PREFIX}#${colaboradorId}`;
}

function sk() {
  return SK_METADATA;
}

async function validarReglas(data, colaboradorIdExcluir = null) {
  const usuario = await usuariosRepository.obtenerPorId(data.usuarioId);
  if (!usuario) {
    throw new ErrorApp('El usuarioId no corresponde a un usuario existente', 400, CODIGOS.VALIDACION);
  }

  const cargo = await cargosRepository.obtenerPorId(data.cargoId);
  if (!cargo) {
    throw new ErrorApp('El cargoId no corresponde a un cargo existente', 400, CODIGOS.VALIDACION);
  }
  if (cargo.estado !== 'ACTIVO') {
    throw new ErrorApp('No se puede asignar un colaborador a un cargo inactivo', 400, CODIGOS.VALIDACION);
  }

  const existentePorUsuario = await obtenerPorUsuarioId(data.usuarioId);
  if (existentePorUsuario && existentePorUsuario.colaboradorId !== colaboradorIdExcluir) {
    throw new ErrorApp('El usuario ya tiene un perfil de colaborador asociado', 409, CODIGOS.CONFLICTO);
  }
}

async function crear(data) {
  await validarReglas(data);

  const item = {
    pk: pk(data.colaboradorId),
    sk: sk(),
    colaboradorId: data.colaboradorId,
    usuarioId: data.usuarioId,
    cargoId: data.cargoId,
    rolProfesional: data.rolProfesional,
    estado: data.estado || 'ACTIVO',
    fechaAlta: new Date().toISOString(),
    fechaBaja: null,
    fechaActualizacion: new Date().toISOString(),
    observaciones: data.observaciones || null,
    gsi1pk: `USUARIO#${data.usuarioId}`,
    gsi1sk: SK_METADATA,
    gsi2pk: `CARGO#${data.cargoId}`,
    gsi2sk: SK_METADATA,
    gsi3pk: `ESTADO#${data.estado || 'ACTIVO'}`,
    gsi3sk: SK_METADATA,
  };

  await dynamoDb.put({
    TableName: tableColaboradores,
    Item: item,
    ConditionExpression: 'attribute_not_exists(pk)',
  });

  return item;
}

async function listar(filtros = {}) {
  const { estado, cargoId, rolProfesional, limit = 25, lastKey } = filtros;

  const filterParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

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
    params.ExpressionAttributeValues = expressionAttributeValues;
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  if (lastKey) params.ExclusiveStartKey = lastKey;

  const result = await dynamoDb.scan(params);
  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey || null,
  };
}

async function obtenerPorId(colaboradorId) {
  const result = await dynamoDb.get({
    TableName: tableColaboradores,
    Key: { pk: pk(colaboradorId), sk: sk() },
  });
  return result.Item || null;
}

async function obtenerPorUsuarioId(usuarioId) {
  const result = await dynamoDb.query({
    TableName: tableColaboradores,
    IndexName: 'GSI1',
    KeyConditionExpression: 'gsi1pk = :gsi1pk AND begins_with(gsi1sk, :sk)',
    ExpressionAttributeValues: {
      ':gsi1pk': `USUARIO#${usuarioId}`,
      ':sk': SK_METADATA,
    },
  });
  if (!result.Items || result.Items.length === 0) return null;
  return result.Items[0];
}

async function actualizar(colaboradorId, data) {
  const existente = await obtenerPorId(colaboradorId);
  if (!existente) {
    throw new ErrorApp('Colaborador no encontrado', 404, CODIGOS.NO_ENCONTRADO);
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

  if (data.estado === 'INACTIVO' && existente.estado !== 'INACTIVO') {
    updateParts.push('#fechaBaja = :fechaBaja');
    expressionAttributeNames['#fechaBaja'] = 'fechaBaja';
    expressionAttributeValues[':fechaBaja'] = new Date().toISOString();
  }
  if (data.estado === 'ACTIVO' && existente.estado === 'INACTIVO') {
    updateParts.push('#fechaBaja = :fechaBaja');
    expressionAttributeNames['#fechaBaja'] = 'fechaBaja';
    expressionAttributeValues[':fechaBaja'] = null;
  }

  updateParts.push('#fechaActualizacion = :fechaActualizacion');
  expressionAttributeNames['#fechaActualizacion'] = 'fechaActualizacion';
  expressionAttributeValues[':fechaActualizacion'] = new Date().toISOString();

  const result = await dynamoDb.update({
    TableName: tableColaboradores,
    Key: { pk: pk(colaboradorId), sk: sk() },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  });

  return result.Attributes;
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