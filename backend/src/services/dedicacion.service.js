const { dynamoDb, TransactWriteCommand } = require('../config/dynamodb');
const { tableColaboradores } = require('../config/environment');
const { ErrorApp, CODIGOS } = require('../utils/errors');

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
    throw err;
  }
}

module.exports = { reserva, ejecutar };