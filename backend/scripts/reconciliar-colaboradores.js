'use strict';

/**
 * Reconciliación controlada de colaboradores históricos.
 *
 * Por defecto inspecciona y no escribe. Para aplicar, detener las escrituras
 * de la aplicación y utilizar:
 * node backend/scripts/reconciliar-colaboradores.js --apply --sin-escrituras-concurrentes
 *
 * Requiere las variables TABLE_COLABORADORES y TABLE_ASIGNACIONES correctas,
 * y un perfil IAM con permisos de lectura y escritura sobre esas tablas.
 */
const {
  dynamoDb,
  ScanCommand,
  GetCommand,
  TransactWriteCommand,
} = require('../src/config/dynamodb');
const { tableColaboradores, tableAsignaciones } = require('../src/config/environment');
const { recolectarPaginas, recorrerSecuencial } = require('../src/utils/paginacion');

const aplicar = process.argv.includes('--apply');
const confirmado = process.argv.includes('--sin-escrituras-concurrentes');

async function consultarPaginas(Comando, parametros) {
  return recolectarPaginas(lastKey => dynamoDb.send(new Comando({
    ...parametros,
    ...(lastKey && { ExclusiveStartKey: lastKey }),
  })));
}

async function listarColaboradores() {
  return consultarPaginas(ScanCommand, {
    TableName: tableColaboradores,
    ConsistentRead: true,
    FilterExpression: 'attribute_exists(#usuario)',
    ExpressionAttributeNames: { '#usuario': 'usuarioId' },
    ProjectionExpression: 'colaboradorId, #usuario, dedicacionReservada',
  });
}

async function dedicacionesActivasPorColaborador() {
  // Una sola lectura consistente de la tabla base evita los retrasos del GSI1
  // y permite comparar las reservas contra el historial real.
  const asignaciones = await consultarPaginas(ScanCommand, {
    TableName: tableAsignaciones,
    ConsistentRead: true,
    FilterExpression: '#estado = :activa',
    ExpressionAttributeNames: { '#estado': 'estado' },
    ExpressionAttributeValues: { ':activa': 'ACTIVA' },
    ProjectionExpression: 'asignacionId, colaboradorId, porcentajeDedicacion',
  });
  const totales = new Map();
  for (const asignacion of asignaciones) {
    const id = asignacion.colaboradorId;
    const porcentaje = asignacion.porcentajeDedicacion;
    if (!id || !Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      throw new Error('Asignación activa sin colaborador o porcentaje válido: ' + asignacion.asignacionId);
    }
    const total = (totales.get(id) || 0) + porcentaje;
    if (total > 100) throw new Error('Dedicación acumulada superior a 100 %: ' + id);
    totales.set(id, total);
  }
  return totales;
}

async function revisarColaborador(item, totales) {
  const total = totales.get(item.colaboradorId) || 0;
  const reserva = await dynamoDb.send(new GetCommand({
    TableName: tableColaboradores,
    Key: { colaboradorId: 'USUARIO#' + item.usuarioId },
    ConsistentRead: true,
  }));
  if (reserva.Item && reserva.Item.propietarioColaboradorId !== item.colaboradorId) {
    throw new Error('Reserva de usuario en conflicto: ' + item.usuarioId);
  }
  const actual = item.dedicacionReservada;
  if (actual !== undefined && (!Number.isFinite(actual) || actual !== total)) {
    throw new Error('Dedicación del colaborador ' + item.colaboradorId +
      ' no coincide con sus asignaciones: almacenada=' + actual + ', calculada=' + total);
  }
  const necesitaReserva = !reserva.Item;
  const necesitaDedicacion = actual === undefined;
  return necesitaReserva || necesitaDedicacion
    ? { item, total, necesitaReserva, necesitaDedicacion }
    : null;
}

async function preparar() {
  const colaboradores = await listarColaboradores();
  const totales = await dedicacionesActivasPorColaborador();
  const ids = new Set(colaboradores.map(item => item.colaboradorId));
  for (const colaboradorId of totales.keys()) {
    if (!ids.has(colaboradorId)) {
      throw new Error('Asignación activa de un colaborador inexistente: ' + colaboradorId);
    }
  }
  const duplicados = new Map();
  for (const item of colaboradores) {
    if (!item.usuarioId || !item.colaboradorId) throw new Error('Colaborador sin identificadores completos');
    const previo = duplicados.get(item.usuarioId);
    if (previo && previo !== item.colaboradorId) {
      throw new Error('Un usuario ya tiene varios perfiles: ' + item.usuarioId);
    }
    duplicados.set(item.usuarioId, item.colaboradorId);
  }

  const pendientes = [];
  await recorrerSecuencial(colaboradores, async item => {
    const pendiente = await revisarColaborador(item, totales);
    if (pendiente) pendientes.push(pendiente);
  });
  return { total: colaboradores.length, pendientes };
}

async function aplicarCambios(preparados) {
  await recorrerSecuencial(preparados.pendientes, async pendiente => {
    const { item, total, necesitaReserva, necesitaDedicacion } = pendiente;
    const operaciones = [];
    if (necesitaReserva) {
      operaciones.push({ Put: {
        TableName: tableColaboradores,
        Item: {
          colaboradorId: 'USUARIO#' + item.usuarioId,
          propietarioColaboradorId: item.colaboradorId,
        },
        ConditionExpression: 'attribute_not_exists(colaboradorId)',
      } });
    }
    if (necesitaDedicacion) {
      operaciones.push({ Update: {
        TableName: tableColaboradores,
        Key: { colaboradorId: item.colaboradorId },
        UpdateExpression: 'SET dedicacionReservada = :dedicacion',
        ConditionExpression: 'attribute_exists(colaboradorId) AND attribute_not_exists(dedicacionReservada)',
        ExpressionAttributeValues: { ':dedicacion': total },
      } });
    }
    await dynamoDb.send(new TransactWriteCommand({ TransactItems: operaciones }));
    process.stdout.write('Reconciliado: ' + item.colaboradorId + '\n');
  });
}

async function main() {
  if (aplicar && !confirmado) {
    throw new Error('Para escribir debe detener las escrituras concurrentes y pasar --sin-escrituras-concurrentes');
  }
  if (aplicar && (!process.env.TABLE_COLABORADORES || !process.env.TABLE_ASIGNACIONES)) {
    throw new Error('Debe definir TABLE_COLABORADORES y TABLE_ASIGNACIONES antes de aplicar cambios');
  }
  process.stdout.write('Modo: ' + (aplicar ? 'APLICAR' : 'INSPECCIÓN SIN ESCRITURAS') + '\n');
  process.stdout.write('Tablas: ' + tableColaboradores + ', ' + tableAsignaciones + '\n');
  const preparados = await preparar();
  process.stdout.write('Colaboradores: ' + preparados.total +
    ' | Registros por reconciliar: ' + preparados.pendientes.length + '\n');
  for (const p of preparados.pendientes) {
    process.stdout.write('  ' + p.item.colaboradorId + ' | reserva=' + p.necesitaReserva +
      ' | dedicación=' + p.necesitaDedicacion + ' | total=' + p.total + '\n');
  }
  if (aplicar) {
    await aplicarCambios(preparados);
    process.stdout.write('Aplicación finalizada. Verifique de nuevo en modo inspección.\n');
  }
}

main().catch((err) => {
  process.stderr.write('Reconciliación detenida: ' + err.message + '\n');
  process.exitCode = 1;
});
