const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('../config/dynamodb');
const { tableColaboradorHabilidad, tableColaboradores, tableHabilidades } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');

const PK_PREFIX = 'COLABORADOR';
const SK_PREFIX = 'HABILIDAD';

function pk(colaboradorId) {
  return `${PK_PREFIX}#${colaboradorId}`;
}

function sk(habilidadId) {
  return `${SK_PREFIX}#${habilidadId}`;
}

const NIVELES_VALIDOS = ['JUNIOR', 'MID', 'SENIOR'];

function validarNivel(nivel) {
  if (!NIVELES_VALIDOS.includes(nivel)) {
    throw new ErrorApp(`Nivel de dominio inválido. Valores permitidos: ${NIVELES_VALIDOS.join(', ')}`, 400, CODIGOS.VALIDACION);
  }
}

async function asociar(data) {
  validarNivel(data.nivel);

  const colaborador = await dynamoDb.send(
    new GetCommand({
      TableName: tableColaboradores,
      Key: { pk: `COLABORADOR#${data.colaboradorId}`, sk: 'METADATA' },
    })
  );
  if (!colaborador.Item) {
    throw new ErrorApp('Colaborador no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  }

  const habilidad = await dynamoDb.send(
    new GetCommand({
      TableName: tableHabilidades,
      Key: { pk: `HABILIDAD#${data.habilidadId}`, sk: 'METADATA' },
    })
  );
  if (!habilidad.Item) {
    throw new ErrorApp('Habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }

  const item = {
    pk: pk(data.colaboradorId),
    sk: sk(data.habilidadId),
    colaboradorId: data.colaboradorId,
    habilidadId: data.habilidadId,
    nivel: data.nivel,
    anosExperiencia: data.anosExperiencia || 0,
    observaciones: data.observaciones || null,
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    gsi1pk: `HABILIDAD#${data.habilidadId}`,
    gsi1sk: `COLABORADOR#${data.colaboradorId}`,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: tableColaboradorHabilidad,
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk)',
    })
  );

  return item;
}

async function listarPorColaborador(colaboradorId) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: tableColaboradorHabilidad,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `COLABORADOR#${colaboradorId}`,
        ':sk': 'HABILIDAD#',
      },
    })
  );
  return result.Items || [];
}

async function obtenerPorColaboradorYHabilidad(colaboradorId, habilidadId) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: tableColaboradorHabilidad,
      Key: { pk: pk(colaboradorId), sk: sk(habilidadId) },
    })
  );
  return result.Item || null;
}

async function actualizarNivel(colaboradorId, habilidadId, data) {
  const existente = await obtenerPorColaboradorYHabilidad(colaboradorId, habilidadId);
  if (!existente) {
    throw new ErrorApp('Relación colaborador-habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }

  if (data.nivel !== undefined) {
    validarNivel(data.nivel);
  }

  const updateParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  if (data.nivel !== undefined) {
    updateParts.push('#nivel = :nivel');
    expressionAttributeNames['#nivel'] = 'nivel';
    expressionAttributeValues[':nivel'] = data.nivel;
  }
  if (data.anosExperiencia !== undefined) {
    updateParts.push('#anosExperiencia = :anosExperiencia');
    expressionAttributeNames['#anosExperiencia'] = 'anosExperiencia';
    expressionAttributeValues[':anosExperiencia'] = data.anosExperiencia;
  }
  if (data.observaciones !== undefined) {
    updateParts.push('#observaciones = :observaciones');
    expressionAttributeNames['#observaciones'] = 'observaciones';
    expressionAttributeValues[':observaciones'] = data.observaciones;
  }

  updateParts.push('#fechaActualizacion = :fechaActualizacion');
  expressionAttributeNames['#fechaActualizacion'] = 'fechaActualizacion';
  expressionAttributeValues[':fechaActualizacion'] = new Date().toISOString();

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: tableColaboradorHabilidad,
      Key: { pk: pk(colaboradorId), sk: sk(habilidadId) },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

async function actualizarExperiencia(colaboradorId, habilidadId, data) {
  return actualizarNivel(colaboradorId, habilidadId, data);
}

async function retirar(colaboradorId, habilidadId) {
  const existente = await obtenerPorColaboradorYHabilidad(colaboradorId, habilidadId);
  if (!existente) {
    throw new ErrorApp('Relación colaborador-habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }

  await dynamoDb.send(
    new DeleteCommand({
      TableName: tableColaboradorHabilidad,
      Key: { pk: pk(colaboradorId), sk: sk(habilidadId) },
    })
  );

  return true;
}

async function listarPorHabilidad(habilidadId, filtros = {}) {
  const { nivel, limit = 25, lastKey } = filtros;

  const params = {
    TableName: tableColaboradorHabilidad,
    IndexName: 'GSI1',
    KeyConditionExpression: 'gsi1pk = :gsi1pk AND begins_with(gsi1sk, :sk)',
    ExpressionAttributeValues: {
      ':gsi1pk': `HABILIDAD#${habilidadId}`,
      ':sk': 'COLABORADOR#',
    },
    Limit: limit,
  };

  if (nivel) {
    params.FilterExpression = '#nivel = :nivel';
    params.ExpressionAttributeNames = { '#nivel': 'nivel' };
    params.ExpressionAttributeValues = {
      ...params.ExpressionAttributeValues,
      ':nivel': nivel,
    };
  }

  if (lastKey) params.ExclusiveStartKey = lastKey;

  const result = await dynamoDb.send(new QueryCommand(params));
  return {
    items: result.Items || [],
    lastKey: result.LastEvaluatedKey || null,
  };
}

module.exports = {
  asociar,
  listarPorColaborador,
  actualizarNivel,
  actualizarExperiencia,
  retirar,
  listarPorHabilidad,
  obtenerPorColaboradorYHabilidad,
  validarNivel,
};
