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

const NIVELES_VALIDOS = ['JUNIOR', 'MID', 'SENIOR'];

function validarNivel(nivel) {
  if (!NIVELES_VALIDOS.includes(nivel)) {
    throw new ErrorApp(`Nivel de dominio inválido. Valores permitidos: ${NIVELES_VALIDOS.join(', ')}`, 400, CODIGOS.VALIDACION);
  }
}

function obtenerAnosExperiencia(data) {
  const valor = data.anosExperiencia ?? data.aniosExperiencia;

  if (valor === undefined) return undefined;

  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    valor < 0
  ) {
    throw new ErrorApp(
      'Los años de experiencia deben ser un número mayor o igual a 0',
      400,
      CODIGOS.VALIDACION
    );
  }

  return valor;
}

async function asociar(data) {
  validarNivel(data.nivel);

  const colaborador = await dynamoDb.send(
    new GetCommand({
      TableName: tableColaboradores,
      Key: { colaboradorId: data.colaboradorId },
    })
  );
  if (!colaborador.Item) {
    throw new ErrorApp('Colaborador no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  }

  const habilidad = await dynamoDb.send(
    new GetCommand({
      TableName: tableHabilidades,
      Key: { habilidadId: data.habilidadId },
    })
  );
  if (!habilidad.Item) {
    throw new ErrorApp('Habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }

  const item = {
    colaboradorId: data.colaboradorId,
    habilidadId: data.habilidadId,
    nivel: data.nivel,
    anosExperiencia: obtenerAnosExperiencia(data) ?? 0,
    observaciones: data.observaciones || null,
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    nivelColaboradorKey: `${data.nivel}#${data.colaboradorId}`,
  };

  await dynamoDb.send(
    new PutCommand({
      TableName: tableColaboradorHabilidad,
      Item: item,
      ConditionExpression: 'attribute_not_exists(colaboradorId)',
    })
  );

  return item;
}

async function listarPorColaborador(colaboradorId) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: tableColaboradorHabilidad,
      KeyConditionExpression: 'colaboradorId = :id',
      ExpressionAttributeValues: { ':id': colaboradorId },
    })
  );
  return result.Items || [];
}

async function obtenerPorColaboradorYHabilidad(colaboradorId, habilidadId) {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: tableColaboradorHabilidad,
      Key: { colaboradorId, habilidadId },
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
    updateParts.push('nivelColaboradorKey = :nivelKey');
    expressionAttributeValues[':nivelKey'] = `${data.nivel}#${colaboradorId}`;
  }
  const anosExperiencia = obtenerAnosExperiencia(data);

  if (anosExperiencia !== undefined) {
    updateParts.push('#anosExperiencia = :anosExperiencia');
    expressionAttributeNames['#anosExperiencia'] = 'anosExperiencia';
    expressionAttributeValues[':anosExperiencia'] = anosExperiencia;
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
      Key: { colaboradorId, habilidadId },
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
      Key: { colaboradorId, habilidadId },
    })
  );

  return true;
}

async function listarPorHabilidad(habilidadId, filtros = {}) {
  const { nivel, limit = 25, lastKey } = filtros;

  const params = {
    TableName: tableColaboradorHabilidad,
    IndexName: 'GSI1',
    KeyConditionExpression: 'habilidadId = :id',
    ExpressionAttributeValues: { ':id': habilidadId },
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
