const { dynamoDb, TransactWriteCommand, QueryCommand, GetCommand, ScanCommand } = require('../config/dynamodb');
const { v5: uuidv5 } = require('uuid');
const { tableColaboradores, tableAsignaciones, tableProyectoHabilidad, tableColaboradorHabilidad, tableProyectos } = require('../config/environment');
const { evaluarElegibilidad } = require('./elegibilidad.service');
const { ErrorApp, CODIGOS } = require('../utils/errors');

// Identificador estable por pareja: la condición de escritura impide carreras simultáneas
// incluso cuando dos peticiones consultan el índice GSI2 al mismo tiempo.
function idAsignacionUnica(proyectoId, colaboradorId) {
  return uuidv5(JSON.stringify([proyectoId, colaboradorId]), uuidv5.URL);
}

// Incluye el historial: no se puede duplicar un colaborador dentro del mismo proyecto.
async function verificarAsignacionUnica(proyectoId, colaboradorId) {
  // El identificador determinista protege las escrituras nuevas en la transacción.
  const existente = await dynamoDb.send(new GetCommand({
    TableName: tableAsignaciones,
    Key: { asignacionId: idAsignacionUnica(proyectoId, colaboradorId) },
    ConsistentRead: true,
  }));
  if (existente.Item) {
    throw new ErrorApp('Este colaborador ya tiene una asignación registrada en este proyecto',
      409, CODIGOS.CONFLICTO);
  }
  let cursor;
  do {
    // Los identificadores aleatorios históricos no se detectan con el Get anterior.
    // Un Scan consistente de todas las páginas evita falsos negativos del GSI2.
    const respuesta = await dynamoDb.send(new ScanCommand({
      TableName: tableAsignaciones,
      ConsistentRead: true,
      FilterExpression: '#p = :proyecto AND #c = :colaborador',
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
// Contador transaccional para impedir cierres mientras se crean o liberan asignaciones.
function actividadProyecto(proyectoId, delta, usuarioId = null, requisitosRevision = null) {
  if (![1, -1].includes(delta)) {
    throw new ErrorApp('Variación de actividad del proyecto inválida', 400, CODIGOS.VALIDACION);
  }
  const alta = delta === 1;
  if (alta && !usuarioId) throw new ErrorApp('Identidad de colaborador requerida', 400, CODIGOS.VALIDACION);
  return { Update: {
    TableName: tableProyectos,
    Key: { proyectoId },
    UpdateExpression: 'SET #activas = #activas + :delta',
    ConditionExpression: 'attribute_exists(proyectoId) AND attribute_exists(#activas) AND #activas >= :min' +
      (alta ? ' AND #estado = :activo AND #lider <> :usuario' :
        ' AND (#estado = :activo OR #estado = :pausado)') +
      (alta && requisitosRevision !== null ? ' AND (attribute_not_exists(#rev) OR #rev = :revEsperada)' : ''),
    ExpressionAttributeNames: { '#activas': 'asignacionesActivas', '#estado': 'estado',
      ...(alta && { '#lider': 'liderId' }),
      ...(alta && requisitosRevision !== null && { '#rev': 'requisitosRevision' }) },

    ExpressionAttributeValues: { ':delta': delta, ':min': alta ? 0 : 1, ':activo': 'ACTIVO',
      ...(alta ? { ':usuario': usuarioId } : { ':pausado': 'PAUSADO' }),
      ...(alta && requisitosRevision !== null && { ':revEsperada': requisitosRevision }) },
  } };
}

function reserva(colaboradorId, delta, habilidadesRevision = null) {
  if (!Number.isFinite(delta)) throw new ErrorApp('Dedicación inválida', 400, CODIGOS.VALIDACION);
  return { Update: {
    TableName: tableColaboradores,
    Key: { colaboradorId },
    UpdateExpression: 'SET dedicacionReservada = dedicacionReservada + :delta',
    ConditionExpression: 'attribute_exists(colaboradorId) AND attribute_exists(dedicacionReservada) AND dedicacionReservada BETWEEN :min AND :max AND #estado = :activo' +
      (habilidadesRevision !== null ? ' AND (attribute_not_exists(#rev) OR #rev = :revEsperada)' : ''),
    ExpressionAttributeNames: { '#estado': 'estado',
      ...(habilidadesRevision !== null && { '#rev': 'habilidadesRevision' }) },
    ExpressionAttributeValues: {
      ':delta': delta, ':min': Math.max(0, -delta), ':max': Math.min(100, 100 - delta), ':activo': 'ACTIVO',
      ...(habilidadesRevision !== null && { ':revEsperada': habilidadesRevision }),
    },
  } };
}

async function leerRelacionesActuales(tabla, atributo, id) {
  const items = [];
  let cursor;
  do {
    const pagina = await dynamoDb.send(new QueryCommand({
      TableName: tabla,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeNames: { '#id': atributo },
      ExpressionAttributeValues: { ':id': id },
      ConsistentRead: true,
      ...(cursor && { ExclusiveStartKey: cursor }),
    }));
    items.push(...(pagina.Items || []));
    cursor = pagina.LastEvaluatedKey;
  } while (cursor);
  return items;
}

async function verificarHabilidadesObligatorias(proyectoId, colaboradorId) {
  // Las revisiones se leen ANTES de los ítems de habilidades. Toda escritura posterior
  // cambia la revisión en la misma transacción que el dato correspondiente.
  const [proyecto, colaborador] = await Promise.all([
    dynamoDb.send(new GetCommand({ TableName: tableProyectos, Key: { proyectoId }, ConsistentRead: true })),
    dynamoDb.send(new GetCommand({ TableName: tableColaboradores, Key: { colaboradorId }, ConsistentRead: true })),
  ]);
  if (proyecto.Item?.estado !== 'ACTIVO' || colaborador.Item?.estado !== 'ACTIVO') {
    throw new ErrorApp('El proyecto o el colaborador no está activo', 409, CODIGOS.CONFLICTO);
  }
  const requisitos = await leerRelacionesActuales(tableProyectoHabilidad, 'proyectoId', proyectoId);
  if (!requisitos.length) {
    throw new ErrorApp('El proyecto no tiene requisitos de habilidades verificables', 409, CODIGOS.CONFLICTO);
  }
  const habilidades = await leerRelacionesActuales(tableColaboradorHabilidad, 'colaboradorId', colaboradorId);
  const resultado = evaluarElegibilidad({ habilidades }, requisitos);
  if (!resultado.elegible) {
    const faltantes = resultado.obligatoriosIncumplidos.map(item => item.habilidadId).join(', ');
    throw new ErrorApp('No cumple las habilidades obligatorias del proyecto: ' + faltantes, 409, CODIGOS.CONFLICTO);
  }
  return {
    ...resultado,
    requisitosRevision: proyecto.Item.requisitosRevision ?? 0,
    habilidadesRevision: colaborador.Item.habilidadesRevision ?? 0,
  };
}

function cuentaActiva(usuarioId, tableUsuarios) {
  return { ConditionCheck: {
    TableName: tableUsuarios, Key: { usuarioId },
    ConditionExpression: '#estado = :activo',
    ExpressionAttributeNames: { '#estado': 'estado' },
    ExpressionAttributeValues: { ':activo': 'ACTIVO' },
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
  verificarLiderDistinto, condicionProyectoAsignable, actividadProyecto,
  verificarHabilidadesObligatorias, cuentaActiva };