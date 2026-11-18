'use strict';

/**
 * Inicializa el contador transaccional de asignaciones activas en proyectos históricos.
 * Por defecto solo inspecciona. Antes de aplicar, se deben detener todas las escrituras:
 *
 * node backend/scripts/reconciliar-proyectos.js --apply --sin-escrituras-concurrentes
 *
 * La inspección utiliza lecturas fuertemente consistentes de las tablas base (no GSIs).
 * No corrige contadores existentes que no coincidan: requieren investigación manual.
 */
const { dynamoDb, ScanCommand, UpdateCommand } = require('../src/config/dynamodb');
const { tableProyectos, tableAsignaciones } = require('../src/config/environment');
const { recolectarPaginas, recorrerSecuencial } = require('../src/utils/paginacion');

const aplicar = process.argv.includes('--apply');
const escriturasDetenidas = process.argv.includes('--sin-escrituras-concurrentes');

async function escanear(parametros) {
  return recolectarPaginas(cursor => dynamoDb.send(new ScanCommand({
    ...parametros, ConsistentRead: true,
    ...(cursor && { ExclusiveStartKey: cursor }),
  })));
}

async function inspeccionar() {
  const [proyectos, activas] = await Promise.all([
    escanear({ TableName: tableProyectos, ProjectionExpression: 'proyectoId, #estado, asignacionesActivas',
      ExpressionAttributeNames: { '#estado': 'estado' } }),
    escanear({ TableName: tableAsignaciones, FilterExpression: '#estado = :activa',
      ExpressionAttributeNames: { '#estado': 'estado' }, ExpressionAttributeValues: { ':activa': 'ACTIVA' },
      ProjectionExpression: 'asignacionId, proyectoId, #estado' }),
  ]);
  const conteos = new Map();
  for (const asignacion of activas) {
    if (!asignacion.proyectoId) throw new Error('Asignación activa sin proyectoId: ' + asignacion.asignacionId);
    conteos.set(asignacion.proyectoId, (conteos.get(asignacion.proyectoId) || 0) + 1);
  }
  const idsProyectos = new Set(proyectos.map(item => item.proyectoId));
  for (const id of conteos.keys()) {
    if (!idsProyectos.has(id)) throw new Error('Existen asignaciones activas sin proyecto: ' + id);
  }
  const pendientes = [];
  for (const proyecto of proyectos) {
    const calculadas = conteos.get(proyecto.proyectoId) || 0;
    if (['COMPLETADO', 'CANCELADO'].includes(proyecto.estado) && calculadas > 0) {
      throw new Error('Proyecto cerrado con asignaciones activas: ' + proyecto.proyectoId);
    }
    if (proyecto.asignacionesActivas === undefined) {
      pendientes.push({ proyectoId: proyecto.proyectoId, estado: proyecto.estado, calculadas });
    } else if (proyecto.asignacionesActivas !== calculadas) {
      throw new Error('Contador inconsistente de ' + proyecto.proyectoId +
        ': almacenado=' + proyecto.asignacionesActivas + ', real=' + calculadas);
    }
  }
  return { total: proyectos.length, activas: activas.length, pendientes };
}

async function main() {
  if (aplicar && !escriturasDetenidas) {
    throw new Error('Debe detener las escrituras concurrentes y confirmar --sin-escrituras-concurrentes');
  }
  if (aplicar && (!process.env.TABLE_PROYECTOS || !process.env.TABLE_ASIGNACIONES)) {
    throw new Error('Se requieren TABLE_PROYECTOS y TABLE_ASIGNACIONES explícitas al aplicar cambios');
  }
  process.stdout.write('Modo: ' + (aplicar ? 'APLICAR' : 'INSPECCIÓN SIN ESCRITURAS') + '\n');
  process.stdout.write('Tablas: ' + tableProyectos + ', ' + tableAsignaciones + '\n');
  const resultado = await inspeccionar();
  process.stdout.write('Proyectos: ' + resultado.total + ' | asignaciones activas: ' +
    resultado.activas + ' | contadores pendientes: ' + resultado.pendientes.length + '\n');
  for (const item of resultado.pendientes) {
    process.stdout.write('  ' + item.proyectoId + ' | ' + item.estado + ' | activas=' + item.calculadas + '\n');
  }
  if (!aplicar) return;
  await recorrerSecuencial(resultado.pendientes, async item => {
    await dynamoDb.send(new UpdateCommand({
      TableName: tableProyectos,
      Key: { proyectoId: item.proyectoId },
      UpdateExpression: 'SET asignacionesActivas = :cantidad',
      ConditionExpression: 'attribute_exists(proyectoId) AND attribute_not_exists(asignacionesActivas) AND #estado = :estado',
      ExpressionAttributeNames: { '#estado': 'estado' },
      ExpressionAttributeValues: { ':cantidad': item.calculadas, ':estado': item.estado },
    }));
    process.stdout.write('Reconciliado: ' + item.proyectoId + '\n');
  });
  process.stdout.write('Aplicación finalizada; compruebe de nuevo en modo inspección.\n');
}

main().catch(err => {
  process.stderr.write('Reconciliación detenida: ' + err.message + '\n');
  process.exitCode = 1;
});
