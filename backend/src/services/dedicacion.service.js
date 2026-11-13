const { dynamoDb, TransactWriteCommand, QueryCommand } = require('../config/dynamodb');
const { v5: uuidv5 } = require('uuid');
const { tableColaboradores, tableAsignaciones } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');

// Identificador estable por pareja: la condición de escritura impide carreras simultáneas
// incluso cuando dos peticiones consultan el índice GSI2 al mismo tiempo.
function idAsignacionUnica(proyectoId, colaboradorId) {
  return uuidv5(JSON.stringify([proyectoId, colaboradorId]), uuidv5.URL);
}

// Incluye el historial: no se puede duplicar un colaborador dentro del mismo proyecto.
async function verificarAsignacionUnica(proyectoId, colaboradorId) {
  let cursor;
  do {
    const respuesta = await dynamoDb.send(new QueryCommand({
      TableName: tableAsignaciones,
      IndexName: 'GSI2',
      KeyConditionExpression: '#p = :proyecto',
      FilterExpression: '#c = :colaborador',
      ExpressionAttributeNames: { '#p': 'proyectoId', '#c': 'colaboradorId' },
      ExpressionAttributeValues: { ':proyecto': proyectoId, ':colaborador': colaboradorId },
      ...(cursor && { ExclusiveStartKey: cursor }),
    }));
    if (respuesta.Items?.length) {
      throw new ErrorApp('Este colaborador ya tiene una asignación registrada en este proyecto',
        409, CODIGOS.CONFLICTO);
    }
    cursor = respuesta.LastEvaluatedKey;
  } while (cursor);
}

// Comparar identidades de usuarios, no nombres ni IDs de colaborador.
function verificarLiderDistinto(proyecto, colaborador) {
  if (!proyecto?.liderId || !colaborador?.usuarioId) {
    throw new ErrorApp('No se pudo comprobar la identidad del líder y el colaborador',
      409, CODIGOS.CONFLICTO);
  }
  if (proyecto.liderId === colaborador.usuarioId) {
    throw new ErrorApp('El líder de proyecto no puede asignarse como colaborador a su propio proyecto',
      409, CODIGOS.CONFLICTO);
  }
}

// La condición atómica impide que el líder cambie entre la consulta y la asignación.
function condicionProyectoAsignable(proyectoId, usuarioId, tablaProyectos) {
  return { ConditionCheck: {
    TableName: tablaProyectos,
    Key: { proyectoId },
    ConditionExpression: '#estado = :activo AND attribute_exists(#lider) AND #lider <> :usuario',
    ExpressionAttributeNames: { '#estado': 'estado', '#lider': 'liderId' },
    ExpressionAttributeValues: { ':activo': 'ACTIVO', ':usuario': usuarioId },
  } };
}

// No asumir cero para registros históricos: deben migrarse antes de reservar.
function reserva(colaboradorId, delta) {
  if (!Number.isFinite(delta)) throw new ErrorApp('Dedicación inválida', 400, CODIGOS.VALIDACION);
  return { Update: {
    TableName: tableColaboradores,
    Key: { colaboradorId },
    UpdateExpression: 'SET dedicacionReservada = dedicacionReservada + :delta',
    ConditionExpression: 'attribute_exists(colaboradorId) AND attribute_exists(dedicacionReservada) AND dedicacionReservada BETWEEN :min AND :max AND #estado = :activo',
    ExpressionAttributeNames: { '#estado': 'estado' },
    ExpressionAttributeValues: {
      ':delta': delta, ':min': Math.max(0, -delta), ':max': Math.min(100, 100 - delta), ':activo': 'ACTIVO',
    },
  } };
}

async function ejecutar(items) {
  try {
    await dynamoDb.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (['TransactionCanceledException', 'ConditionalCheckFailedException', 'TransactionConflictException'].includes(err.name)) {
      throw new ErrorApp('Conflicto: dedicación, estado o versión cambió; recargue antes de reintentar', 409, CODIGOS.CONFLICTO);
    }
    // No exponer información interna al navegador; CloudWatch conserva la causa técnica.
    console.error('Error inesperado en transacción de dedicación', {
      tipo: err.name,
      mensaje: err.message,
      awsRequestId: err.$metadata?.requestId,
    });
    throw err;
  }
}

module.exports = { reserva, ejecutar, idAsignacionUnica, verificarAsignacionUnica,
  verificarLiderDistinto, condicionProyectoAsignable };