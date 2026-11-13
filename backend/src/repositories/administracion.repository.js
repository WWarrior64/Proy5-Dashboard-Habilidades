const { dynamoDb, GetCommand, PutCommand } = require('../config/dynamodb');
const { tableAdministracion } = require('../config/environment');

const AREAS = new Set(['configuracion', 'roles-permisos']);

async function obtener(area) {
  if (!AREAS.has(area)) throw new Error('Área de administración desconocida');
  const resultado = await dynamoDb.send(new GetCommand({
    TableName: tableAdministracion,
    Key: { configuracionId: area },
    ConsistentRead: true,
  }));
  return resultado.Item?.contenido || null;
}

async function guardar(area, contenido, actualizadoPor) {
  if (!AREAS.has(area)) throw new Error('Área de administración desconocida');
  const item = {
    configuracionId: area,
    contenido,
    actualizadoPor,
    fechaActualizacion: new Date().toISOString(),
  };
  await dynamoDb.send(new PutCommand({
    TableName: tableAdministracion,
    Item: item,
  }));
  return contenido;
}

module.exports = { obtener, guardar };
