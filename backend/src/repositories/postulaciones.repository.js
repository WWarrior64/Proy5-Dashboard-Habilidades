const dedicacion = require('../services/dedicacion.service');
const { v4: uuidv4 } = require('uuid');
const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} = require('../../src/config/dynamodb.js');
const {
  tablePostulaciones,
  tableProyectos,
  tableColaboradores,
  tableAsignaciones,
} = require('../../src/config/environment.js');
const { ErrorApp, CODIGOS } = require('../../src/utils/errors.js');

const ESTADOS_POSTULACION = ['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'RETIRADA'];

function skPostulacion(colaboradorId) {
  return `POSTULACION#${colaboradorId}`;
}

function ahoraISO() {
  return new Date().toISOString();
}

async function consultarTodasPaginas(parametros) {
  const items = [];
  let lastKey;
  do {
    const pagina = await dynamoDb.send(new QueryCommand({
      ...parametros,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    items.push(...(pagina.Items || []));
    lastKey = pagina.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

function validarEstadoPostulacion(estado) {
  if (!ESTADOS_POSTULACION.includes(estado)) {
    throw new ErrorApp(
      `Estado inválido. Valores permitidos: ${ESTADOS_POSTULACION.join(', ')}`,
      400,
      CODIGOS.VALIDACION
    );
  }
}

async function validarColaboradorActivo(colaboradorId) {
  const resultado = await dynamoDb.send(
    new GetCommand({
      TableName: tableColaboradores,
      Key: { colaboradorId },
    })
  );
  const colaborador = resultado.Item;
  if (!colaborador) {
    throw new ErrorApp('El colaborador no existe', 404, CODIGOS.NO_ENCONTRADO);
  }
  if (colaborador.estado !== 'ACTIVO') {
    throw new ErrorApp('El colaborador no está activo', 400, CODIGOS.VALIDACION);
  }
  return colaborador;
}

async function validarProyectoActivo(proyectoId) {
  const resultado = await dynamoDb.send(
    new GetCommand({
      TableName: tableProyectos,
      Key: { proyectoId },
    })
  );
  const proyecto = resultado.Item;
  if (!proyecto) {
    throw new ErrorApp('El proyecto no existe', 404, CODIGOS.NO_ENCONTRADO);
  }
  if (proyecto.estado !== 'ACTIVO') {
    throw new ErrorApp('Solo se puede postular a proyectos activos', 400, CODIGOS.VALIDACION);
  }
  return proyecto;
}

async function crearPostulacion(datos) {
  const { proyectoId, colaboradorId, postulacionId, comentario } = datos;

  if (!proyectoId || !colaboradorId) {
    throw new ErrorApp('proyectoId y colaboradorId son obligatorios', 400, CODIGOS.VALIDACION);
  }

  const colaborador = await validarColaboradorActivo(colaboradorId);
  const proyecto = await validarProyectoActivo(proyectoId);
  dedicacion.verificarLiderDistinto(proyecto, colaborador);

  const id = postulacionId || uuidv4();
  const ahora = ahoraISO();
  const item = {
    proyectoId,
    postulacionKey: skPostulacion(colaboradorId),
    postulacionId: id,
    colaboradorId,
    estado: 'PENDIENTE',
    fechaPostulacion: ahora,
    colaboradorFechaKey: `${ahora}#${proyectoId}`,
    fechaActualizacion: ahora,
    ...(comentario !== undefined && comentario !== null && { comentario }),
  };

  try {
    // Clave primaria compuesta (proyectoId, POSTULACION#colaboradorId): un
    // colaborador no puede tener dos registros de postulación para el mismo
    // proyecto; el historial se conserva con estados ACEPTADA/RECHAZADA/RETIRADA.
    await dynamoDb.send(
      new PutCommand({
        TableName: tablePostulaciones,
        Item: item,
        ConditionExpression: 'attribute_not_exists(postulacionKey)',
      })
    );
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp(
        'Ya existe una postulación de este colaborador para el proyecto',
        409,
        CODIGOS.CONFLICTO
      );
    }
    throw e;
  }

  return item;
}

async function consultarPostulacionesProyecto(proyectoId) {
  return consultarTodasPaginas({
    TableName: tablePostulaciones,
    KeyConditionExpression: '#p = :p',
    ExpressionAttributeNames: { '#p': 'proyectoId' },
    ExpressionAttributeValues: { ':p': proyectoId },
  });
}

async function consultarPostulacionesColaborador(colaboradorId) {
  return consultarTodasPaginas({
    TableName: tablePostulaciones,
    IndexName: 'GSI1',
    KeyConditionExpression: '#c = :c',
    ExpressionAttributeNames: { '#c': 'colaboradorId' },
    ExpressionAttributeValues: { ':c': colaboradorId },
  });
}

async function obtenerPostulacion(proyectoId, colaboradorId) {
  const resultado = await dynamoDb.send(
    new GetCommand({
      TableName: tablePostulaciones,
      Key: { proyectoId, postulacionKey: skPostulacion(colaboradorId) },
    })
  );
  const postulacion = resultado.Item;
  if (!postulacion) {
    throw new ErrorApp('Postulación no encontrada', 404, CODIGOS.NO_ENCONTRADO);
  }
  return postulacion;
}

/**
 * Proceso transaccional de aceptación de una postulación (Sección E):
 * 1. Consultar la postulación.
 * 2. Verificar que sigue en estado PENDIENTE.
 * 3. Comprobar que el proyecto continúa activo.
 * 4. Comprobar que el colaborador está disponible.
 * 5. Validar las horas y dedicación (límite acumulado del 100 %).
 * 6. Actualizar la postulación a ACEPTADA.
 * 7. Crear el registro de asignación.
 * 8. Validar el porcentaje de dedicación acumulado del colaborador.
 * Todos los cambios se confirman conjuntamente con TransactWriteItems.
 */
async function aceptarPostulacion(proyectoId, colaboradorId, datosRevision) {
  const { revisadoPor, observacionRevision, porcentajeDedicacion, horasAsignadas, fechaInicio } =
    datosRevision || {};

  if (!revisadoPor) {
    throw new ErrorApp('revisadoPor es obligatorio', 400, CODIGOS.VALIDACION);
  }

  const postulacion = await obtenerPostulacion(proyectoId, colaboradorId);
  if (postulacion.estado !== 'PENDIENTE') {
    throw new ErrorApp('La postulación ya fue procesada', 409, CODIGOS.CONFLICTO);
  }
  const proyecto = await validarProyectoActivo(proyectoId);

  const colaborador = await validarColaboradorActivo(colaboradorId);
  dedicacion.verificarLiderDistinto(proyecto, colaborador);
  const reservaPrevia = colaborador.dedicacionReservada;
  if (!Number.isFinite(reservaPrevia) || reservaPrevia < 0 || reservaPrevia > 100) {
    throw new ErrorApp('El colaborador requiere inicializar su dedicación reservada antes de aceptar la postulación',
      409, CODIGOS.CONFLICTO);
  }
  // Los registros anteriores sin dedicación inicializada requieren revisión de sus asignaciones
  // activas antes de regularizarse; no se puede suponer que su dedicación sea cero.

  if (typeof porcentajeDedicacion !== 'number' || !Number.isFinite(porcentajeDedicacion) || porcentajeDedicacion <= 0 || porcentajeDedicacion > 100) {
    throw new ErrorApp('El porcentaje de dedicación debe estar entre 1 y 100', 400, CODIGOS.VALIDACION);
  }
  if (typeof horasAsignadas !== 'number' || !Number.isFinite(horasAsignadas) || horasAsignadas <= 0) {
    throw new ErrorApp('Las horas asignadas deben ser un número positivo', 400, CODIGOS.VALIDACION);
  }

  // La reserva transaccional es la fuente de verdad, sin depender de un GSI eventual.
  // DynamoDB verificará el límite de 100 % de forma atómica durante la aceptación.
  if ((reservaPrevia ?? 0) + porcentajeDedicacion > 100) {
    throw new ErrorApp('La dedicación acumulada del colaborador superaría el 100 %', 409, CODIGOS.CONFLICTO);
  }

  await dedicacion.verificarAsignacionUnica(proyectoId, colaboradorId);
  const asignacionId = dedicacion.idAsignacionUnica(proyectoId, colaboradorId);
  const ahora = ahoraISO();
  const asignacion = {
    asignacionId,
    colaboradorId,
    proyectoId,
    postulacionId: postulacion.postulacionId,
    porcentajeDedicacion,
    horasAsignadas,
    horasCompletadas: 0,
    fechaInicio: fechaInicio || ahora,
    estado: 'ACTIVA',
    fechaAsignacion: ahora,
    fechaActualizacion: ahora,
    creadoPor: revisadoPor,
    colaboradorFechaKey: `ACTIVA#${ahora}`,
    proyectoFechaKey: `ACTIVA#${ahora}`,
    estadoFechaKey: `${ahora}#${asignacionId}`,
  };

  try {
    await dedicacion.ejecutar([
        dedicacion.reserva(colaboradorId, porcentajeDedicacion),
        dedicacion.condicionProyectoAsignable(proyectoId, colaborador.usuarioId, tableProyectos),
        {
          Update: {
            TableName: tablePostulaciones,
            Key: { proyectoId, postulacionKey: skPostulacion(colaboradorId) },
            ConditionExpression: '#est = :pendiente',
            UpdateExpression:
              'SET #est = :aceptada, fechaRevision = :fecha, revisadoPor = :por, observacionRevision = :obs, fechaActualizacion = :ua',
            ExpressionAttributeNames: { '#est': 'estado' },
            ExpressionAttributeValues: {
              ':pendiente': 'PENDIENTE',
              ':aceptada': 'ACEPTADA',
              ':fecha': ahora,
              ':por': revisadoPor,
              ':obs': observacionRevision || '',
              ':ua': ahora,
            },
          },
        },
        {
          Put: {
            TableName: tableAsignaciones,
            Item: asignacion,
            ConditionExpression: 'attribute_not_exists(asignacionId)',
          },
        },
      ]);
  } catch (e) {
    // dedicacion.ejecutar convierte condiciones fallidas en ErrorApp(409).
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('La postulación ya fue procesada o las condiciones cambiaron', 409, CODIGOS.CONFLICTO);
    }
    throw e;
  }

  return {
    postulacion: {
      ...postulacion,
      estado: 'ACEPTADA',
      fechaRevision: ahora,
      revisadoPor,
      observacionRevision,
    },
    asignacion,
  };
}

async function cambiarEstadoPostulacion(proyectoId, colaboradorId, estado, revisadoPor, observacionRevision) {
  validarEstadoPostulacion(estado);
  const postulacion = await obtenerPostulacion(proyectoId, colaboradorId);
  if (postulacion.estado !== 'PENDIENTE') {
    throw new ErrorApp('La postulación ya fue procesada', 409, CODIGOS.CONFLICTO);
  }
  const ahora = ahoraISO();
  try {
    const resultado = await dynamoDb.send(
      new UpdateCommand({
        TableName: tablePostulaciones,
        Key: { proyectoId, postulacionKey: skPostulacion(colaboradorId) },
        UpdateExpression:
          'SET #est = :estado, fechaRevision = :fecha, revisadoPor = :por, observacionRevision = :obs, fechaActualizacion = :ua',
        ExpressionAttributeNames: { '#est': 'estado' },
        ExpressionAttributeValues: {
          ':estado': estado,
          ':pendiente': 'PENDIENTE',
          ':fecha': ahora,
          ':por': revisadoPor,
          ':obs': observacionRevision || '',
          ':ua': ahora,
        },
        ConditionExpression: '#est = :pendiente',
        ReturnValues: 'ALL_NEW',
      })
    );
    if (!resultado.Attributes) {
      throw new ErrorApp('Postulación no encontrada', 404, CODIGOS.NO_ENCONTRADO);
    }
    return resultado.Attributes;
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('La postulación ya fue procesada', 409, CODIGOS.CONFLICTO);
    }
    throw e;
  }
}

async function rechazarPostulacion(proyectoId, colaboradorId, datosRevision) {
  const { revisadoPor, observacionRevision } = datosRevision || {};
  if (!revisadoPor) {
    throw new ErrorApp('revisadoPor es obligatorio', 400, CODIGOS.VALIDACION);
  }
  return cambiarEstadoPostulacion(proyectoId, colaboradorId, 'RECHAZADA', revisadoPor, observacionRevision);
}

async function retirarPostulacion(proyectoId, colaboradorId, datosRevision) {
  const { revisadoPor, observacionRevision } = datosRevision || {};
  if (!revisadoPor) {
    throw new ErrorApp('revisadoPor es obligatorio', 400, CODIGOS.VALIDACION);
  }
  return cambiarEstadoPostulacion(proyectoId, colaboradorId, 'RETIRADA', revisadoPor, observacionRevision);
}

module.exports = {
  crearPostulacion,
  consultarPostulacionesProyecto,
  consultarPostulacionesColaborador,
  obtenerPostulacion,
  aceptarPostulacion,
  rechazarPostulacion,
  retirarPostulacion,
  cambiarEstadoPostulacion,
  validarColaboradorActivo,
  validarProyectoActivo,
  ESTADOS_POSTULACION,
};
