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
  QueryCommand,
  TransactWriteCommand,
} = require('../src/config/dynamodb');
const { tableColaboradores, tableAsignaciones } = require('../src/config/environment');

const aplicar = process.argv.includes('--apply');
const confirmado = process.argv.includes('--sin-escrituras-concurrentes');

async function consultarPaginas(Comando, parametros) {
  const items = [];
  let lastKey;
  do {
    const respuesta = await dynamoDb.send(new Comando({
      ...parametros,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    items.push(...(respuesta.Items || []));
    lastKey = respuesta.LastEvaluatedKey;
  } while (lastKey);
  return items;
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

async function sumaAsignacionesActivas(colaboradorId) {
  const asignaciones = await consultarPaginas(QueryCommand, {
    TableName: tableAsignaciones,
    IndexName: 'GSI1',
    KeyConditionExpression: '#colaborador = :colaborador AND begins_with(#clave, :prefijo)',
    ExpressionAttributeNames: {
      '#colaborador': 'colaboradorId',
      '#clave': 'colaboradorFechaKey',
    },
    ExpressionAttributeValues: {
      ':colaborador': colaboradorId,
      ':prefijo': 'ACTIVA#',
    },
    ProjectionExpression: 'porcentajeDedicacion',
  });
  let total = 0;
  for (const asignacion of asignaciones) {
    const porcentaje = asignacion.porcentajeDedicacion;
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      throw new Error('Asignación activa con porcentaje inválido de ' + colaboradorId);
    }
    total += porcentaje;
  }
  if (total > 100) throw new Error('Dedicación acumulada superior a 100 %: ' + colaboradorId);
  return total;
}

async function preparar() {
  const colaboradores = await listarColaboradores();
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
  for (const item of colaboradores) {
    const total = await sumaAsignacionesActivas(item.colaboradorId);
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
    if (necesitaReserva || necesitaDedicacion) {
      pendientes.push({ item, total, necesitaReserva, necesitaDedicacion });
    }
  }
  return { total: colaboradores.length, pendientes };
}

async function aplicarCambios(preparados) {
  for (const pendiente of preparados.pendientes) {
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
  }
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
