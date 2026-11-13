const { dynamoDb, QueryCommand, ScanCommand } = require('../../src/config/dynamodb.js');
const {
  tableColaboradores,
  tableProyectos,
  tableAsignaciones,
  tablePostulaciones,
  tableHabilidades,
  tableProyectoHabilidad,
} = require('../../src/config/environment.js');

const ESTADOS_PROYECTO = ['BORRADOR', 'ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO'];
const ESTADOS_POSTULACION = ['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'RETIRADA'];

// DynamoDB devuelve resultados paginados incluso cuando se utiliza Select: COUNT.
// Recorremos todas las páginas para no mostrar métricas incompletas.
async function consultarPaginas(Comando, parametros) {
  const items = [];
  let count = 0;
  let lastKey;
  do {
    const resultado = await dynamoDb.send(new Comando({
      ...parametros,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    count += resultado.Count || 0;
    items.push(...(resultado.Items || []));
    lastKey = resultado.LastEvaluatedKey;
  } while (lastKey);
  return { Count: count, Items: items };
}

async function contarColaboradoresActivos() {
  const resultado = await consultarPaginas(QueryCommand, {
      TableName: tableColaboradores,
      IndexName: 'GSI2',
      KeyConditionExpression: '#est = :est',
      ExpressionAttributeNames: { '#est': 'estado' },
      ExpressionAttributeValues: { ':est': 'ACTIVO' },
      Select: 'COUNT',
  });
  return resultado.Count || 0;
}

async function contarProyectosPorEstado() {
  const conteo = {};
  for (const estado of ESTADOS_PROYECTO) {
    const resultado = await consultarPaginas(QueryCommand, {
      TableName: tableProyectos,
      IndexName: 'GSI1',
      KeyConditionExpression: '#est = :est',
      ExpressionAttributeNames: { '#est': 'estado' },
      ExpressionAttributeValues: { ':est': estado },
      Select: 'COUNT',
    });
    conteo[estado] = resultado.Count || 0;
  }
  return conteo;
}

async function contarAsignacionesActivas() {
  const resultado = await consultarPaginas(QueryCommand, {
    TableName: tableAsignaciones,
    IndexName: 'GSI3',
    KeyConditionExpression: '#est = :est',
    ExpressionAttributeNames: { '#est': 'estado' },
    ExpressionAttributeValues: { ':est': 'ACTIVA' },
    Select: 'COUNT',
  });
  return resultado.Count || 0;
}

async function obtenerDistribucionHabilidades() {
  // Distribución de habilidades requeridas por proyecto. Se lee el catálogo
  // de habilidades (tabla de dimensión pequeña) y se cuenta, por habilidad,
  // las relaciones de proyecto-habilidad mediante su GSI1 (habilidadId).
  // No se ejecuta un Scan sobre las tablas de hechos del sistema.
  const catalogo = await consultarPaginas(ScanCommand, {
    TableName: tableHabilidades,
    ProjectionExpression: 'habilidadId, #nombre',
    FilterExpression: 'attribute_exists(#nombre)',
    ExpressionAttributeNames: { '#nombre': 'nombre' },
  });
  const habilidades = catalogo.Items || [];

  const distribucion = [];
  for (const habilidad of habilidades) {
    const resultado = await consultarPaginas(QueryCommand, {
        TableName: tableProyectoHabilidad,
        IndexName: 'GSI1',
        KeyConditionExpression: '#h = :h',
        ExpressionAttributeNames: { '#h': 'habilidadId' },
        ExpressionAttributeValues: { ':h': habilidad.habilidadId },
        Select: 'COUNT',
    });
    distribucion.push({
      habilidadId: habilidad.habilidadId,
      nombre: habilidad.nombre,
      cantidadProyectos: resultado.Count || 0,
    });
  }

  distribucion.sort((a, b) => b.cantidadProyectos - a.cantidadProyectos);
  return distribucion;
}

async function obtenerPostulacionesPorEstado() {
  // la tabla de postulaciones no tiene GSI sobre estado, por lo que esta métrica se
  // obtiene con una operación puntual (filtrada) sobre esa tabla; no se
  // escanean las demás tablas del sistema.
  const resultado = await consultarPaginas(ScanCommand, {
    TableName: tablePostulaciones,
    ProjectionExpression: '#est',
    ExpressionAttributeNames: { '#est': 'estado' },
    FilterExpression: '#est IN (:pendiente, :aceptada, :rechazada, :retirada)',
    ExpressionAttributeValues: {
      ':pendiente': 'PENDIENTE',
      ':aceptada': 'ACEPTADA',
      ':rechazada': 'RECHAZADA',
      ':retirada': 'RETIRADA',
    },
  });
  const conteo = { PENDIENTE: 0, ACEPTADA: 0, RECHAZADA: 0, RETIRADA: 0 };
  for (const item of resultado.Items || []) {
    if (Object.prototype.hasOwnProperty.call(conteo, item.estado)) {
      conteo[item.estado] += 1;
    }
  }
  return conteo;
}

async function obtenerActividadReciente(parametros = {}) {
  const { dias = 7, limite = 50 } = parametros;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const eventos = [];

  // Proyectos creados/modificados recientemente (GSI1 por estado).
  for (const estado of ESTADOS_PROYECTO) {
    const resultado = await consultarPaginas(QueryCommand, {
        TableName: tableProyectos,
        IndexName: 'GSI1',
        KeyConditionExpression: '#est = :est',
        ExpressionAttributeNames: { '#est': 'estado' },
        ExpressionAttributeValues: { ':est': estado },
    });
    for (const proyecto of resultado.Items || []) {
      if (proyecto.fechaCreacion >= desde) {
        eventos.push({
          tipo: 'proyecto',
          id: proyecto.proyectoId,
          nombre: proyecto.nombre,
          fecha: proyecto.fechaCreacion,
          estado: proyecto.estado,
        });
      }
    }
  }

  // Asignaciones activadas o desvinculadas recientemente (GSI3 por estado).
  for (const estado of ['ACTIVA', 'DESVINCULADA', 'FINALIZADA']) {
    const resultado = await consultarPaginas(QueryCommand, {
        TableName: tableAsignaciones,
        IndexName: 'GSI3',
        KeyConditionExpression: '#est = :est',
        ExpressionAttributeNames: { '#est': 'estado' },
        ExpressionAttributeValues: { ':est': estado },
    });
    for (const asignacion of resultado.Items || []) {
      const fecha = asignacion.estado === 'ACTIVA' ? asignacion.fechaAsignacion : asignacion.fechaFin;
      if (fecha && fecha >= desde) {
        eventos.push({
          tipo: 'asignacion',
          id: asignacion.asignacionId,
          proyectoId: asignacion.proyectoId,
          colaboradorId: asignacion.colaboradorId,
          fecha,
          estado: asignacion.estado,
        });
      }
    }
  }

  eventos.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  return eventos.slice(0, limite);
}

module.exports = {
  contarColaboradoresActivos,
  contarProyectosPorEstado,
  contarAsignacionesActivas,
  obtenerDistribucionHabilidades,
  obtenerPostulacionesPorEstado,
  obtenerActividadReciente,
  ESTADOS_PROYECTO,
  ESTADOS_POSTULACION,
};
