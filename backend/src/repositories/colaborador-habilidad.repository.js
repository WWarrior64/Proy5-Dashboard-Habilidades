const {
  dynamoDb,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} = require('../config/dynamodb');
const { tableColaboradorHabilidad, tableColaboradores, tableHabilidades } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');
const { recolectarPaginas } = require('../utils/paginacion');

const NIVELES_VALIDOS = ['JUNIOR', 'MID', 'SENIOR'];

async function obtenerRevisionColaborador(colaboradorId) {
  const respuesta = await dynamoDb.send(new GetCommand({
    TableName: tableColaboradores, Key: { colaboradorId }, ConsistentRead: true,
  }));
  if (!respuesta.Item) throw new ErrorApp('Colaborador no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  if (respuesta.Item.estado !== 'ACTIVO') {
    throw new ErrorApp('El colaborador está inactivo', 409, CODIGOS.CONFLICTO);
  }
  return respuesta.Item;
}

function revisarHabilidades(colaborador) {
  return { Update: {
    TableName: tableColaboradores,
    Key: { colaboradorId: colaborador.colaboradorId },
    UpdateExpression: 'SET #rev = if_not_exists(#rev, :cero) + :uno',
    ConditionExpression: 'attribute_exists(colaboradorId) AND #estado = :activo AND ' +
      '(attribute_not_exists(#rev) OR #rev = :anterior)',
    ExpressionAttributeNames: { '#rev': 'habilidadesRevision', '#estado': 'estado' },
    ExpressionAttributeValues: {
      ':cero': 0, ':uno': 1, ':activo': 'ACTIVO', ':anterior': colaborador.habilidadesRevision ?? 0,
    },
  } };
}

function relanzarConflicto(err) {
  if (['ConditionalCheckFailedException', 'TransactionCanceledException', 'TransactionConflictException'].includes(err.name)) {
    throw new ErrorApp('La habilidad o el estado del colaborador cambió; recargue antes de reintentar', 409, CODIGOS.CONFLICTO);
  }
  throw err;
}

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
  if (!data?.colaboradorId || !data.habilidadId) {
    throw new ErrorApp('colaboradorId y habilidadId son obligatorios', 400, CODIGOS.VALIDACION);
  }
  validarNivel(data.nivel);

  const colaborador = await dynamoDb.send(
    new GetCommand({
      TableName: tableColaboradores,
      Key: { colaboradorId: data.colaboradorId },
      ConsistentRead: true,
    })
  );
  if (!colaborador.Item) {
    throw new ErrorApp('Colaborador no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  }
  if (colaborador.Item.estado !== 'ACTIVO') {
    throw new ErrorApp('El colaborador está inactivo', 400, CODIGOS.VALIDACION);
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
  if (habilidad.Item.estado !== 'ACTIVO') {
    throw new ErrorApp('No se puede asociar una habilidad inactiva', 400, CODIGOS.VALIDACION);
  }

  const item = {
    colaboradorId: data.colaboradorId,
    habilidadId: data.habilidadId,
    nivel: data.nivel,
    anosExperiencia: obtenerAnosExperiencia(data) ?? 0,
    observaciones: data.observaciones || null,
    fechaUltimoUso: data.fechaUltimoUso || null,
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    nivelColaboradorKey: `${data.nivel}#${data.colaboradorId}`,
  };

  try {
    await dynamoDb.send(new TransactWriteCommand({ TransactItems: [
      revisarHabilidades(colaborador.Item),
      { Put: { TableName: tableColaboradorHabilidad, Item: item,
        ConditionExpression: 'attribute_not_exists(colaboradorId)' } },
    ] }));
  } catch (e) {
    relanzarConflicto(e);
  }
  return item;
}

async function listarPorColaborador(colaboradorId) {
  return recolectarPaginas(lastKey => dynamoDb.send(new QueryCommand({
    TableName: tableColaboradorHabilidad,
    KeyConditionExpression: 'colaboradorId = :id',
    ExpressionAttributeValues: { ':id': colaboradorId },
    ...(lastKey && { ExclusiveStartKey: lastKey }),
  })));
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
  const colaborador = await obtenerRevisionColaborador(colaboradorId);

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
  if (data.fechaUltimoUso !== undefined) {
    updateParts.push('#fechaUltimoUso = :fechaUltimoUso');
    expressionAttributeNames['#fechaUltimoUso'] = 'fechaUltimoUso';
    expressionAttributeValues[':fechaUltimoUso'] = data.fechaUltimoUso;
  }

  updateParts.push('#fechaActualizacion = :fechaActualizacion');
  expressionAttributeNames['#fechaActualizacion'] = 'fechaActualizacion';
  expressionAttributeValues[':fechaActualizacion'] = new Date().toISOString();

  try {
    await dynamoDb.send(new TransactWriteCommand({ TransactItems: [
      revisarHabilidades(colaborador),
      { Update: {
        TableName: tableColaboradorHabilidad, Key: { colaboradorId, habilidadId },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ConditionExpression: 'attribute_exists(colaboradorId) AND attribute_exists(habilidadId)',
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      } },
    ] }));
  } catch (err) { relanzarConflicto(err); }
  const actualizado = await dynamoDb.send(new GetCommand({
    TableName: tableColaboradorHabilidad, Key: { colaboradorId, habilidadId }, ConsistentRead: true,
  }));
  return actualizado.Item;
}

async function actualizarExperiencia(colaboradorId, habilidadId, data) {
  return actualizarNivel(colaboradorId, habilidadId, data);
}

async function retirar(colaboradorId, habilidadId) {
  const existente = await obtenerPorColaboradorYHabilidad(colaboradorId, habilidadId);
  if (!existente) {
    throw new ErrorApp('Relación colaborador-habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }
  const colaborador = await obtenerRevisionColaborador(colaboradorId);

  try {
    await dynamoDb.send(new TransactWriteCommand({ TransactItems: [
      revisarHabilidades(colaborador),
      { Delete: {
        TableName: tableColaboradorHabilidad, Key: { colaboradorId, habilidadId },
        ConditionExpression: 'attribute_exists(colaboradorId) AND attribute_exists(habilidadId)',
      } },
    ] }));
  } catch (err) { relanzarConflicto(err); }
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
