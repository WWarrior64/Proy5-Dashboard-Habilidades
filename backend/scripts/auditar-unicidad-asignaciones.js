'use strict';

/**
 * Auditoría de unicidad histórica en Asignaciones (solo lectura).
 *
 * TABLE_ASIGNACIONES=internal-marketplace-asignaciones-dev node backend/scripts/auditar-unicidad-asignaciones.js
 *
 * Es recomendable detener las escrituras mientras se realiza la auditoría para
 * obtener un resultado estable; no modifica, renombra ni elimina registros.
 */
const { dynamoDb, ScanCommand } = require('../src/config/dynamodb');
const { tableAsignaciones } = require('../src/config/environment');
const { idAsignacionUnica } = require('../src/services/dedicacion.service');
const { recorrerPaginas } = require('../src/utils/paginacion');

function registrarAsignacion(parejas, asignacion) {
  const { asignacionId, proyectoId, colaboradorId } = asignacion;
  if (!asignacionId || !proyectoId || !colaboradorId) {
    throw new Error('Asignación incompleta encontrada: ' + (asignacionId || 'sin identificador'));
  }
  const clave = JSON.stringify([proyectoId, colaboradorId]);
  if (!parejas.has(clave)) parejas.set(clave, []);
  parejas.get(clave).push(asignacionId);
  return asignacionId !== idAsignacionUnica(proyectoId, colaboradorId);
}

async function auditar() {
  if (!process.env.TABLE_ASIGNACIONES) {
    throw new Error('Defina explícitamente TABLE_ASIGNACIONES antes de auditar.');
  }
  const parejas = new Map();
  let cantidad = 0;
  let identificadoresHistoricos = 0;
  await recorrerPaginas(cursor => dynamoDb.send(new ScanCommand({
    TableName: tableAsignaciones,
    ConsistentRead: true,
    ProjectionExpression: 'asignacionId, proyectoId, colaboradorId, #estado',
    ExpressionAttributeNames: { '#estado': 'estado' },
    ...(cursor && { ExclusiveStartKey: cursor }),
  })), asignaciones => {
    for (const asignacion of asignaciones) {
      cantidad += 1;
      if (registrarAsignacion(parejas, asignacion)) identificadoresHistoricos += 1;
    }
  });

  const duplicados = [...parejas.entries()].filter(([, ids]) => ids.length > 1);
  process.stdout.write('Tabla auditada: ' + tableAsignaciones + '\n');
  process.stdout.write('Asignaciones: ' + cantidad + '\n');
  process.stdout.write('Parejas distintas: ' + parejas.size + '\n');
  process.stdout.write('Asignaciones con ID anterior: ' + identificadoresHistoricos + '\n');
  process.stdout.write('Parejas duplicadas: ' + duplicados.length + '\n');
  for (const [clave, ids] of duplicados) {
    process.stdout.write('Duplicado ' + clave + ': ' + ids.join(', ') + '\n');
  }
  if (duplicados.length) {
    throw new Error('Hay asignaciones duplicadas; investigue el historial antes de desplegar.');
  }
  process.stdout.write('Auditoría completada sin escrituras ni duplicidades detectadas.\n');
}

auditar().catch(err => {
  process.stderr.write('Auditoría detenida: ' + err.message + '\n');
  process.exitCode = 1;
});
