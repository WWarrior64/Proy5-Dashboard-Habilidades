const { dynamoDb } = require('../../src/config/dynamodb.js');
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

async function contarColaboradoresActivos() {
  const resultado = await dynamoDb.query({
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
    const resultado = await dynamoDb.query({
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
  const resultado = await dynamoDb.query({
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
  // las relaciones de im_proyecto_habilidad mediante su GSI1 (habilidadId).
  // No se ejecuta un Scan sobre las tablas de hechos del sistema.
  const catalogo = await dynamoDb.scan({
    TableName: tableHabilidades,
    ProjectionExpression: 'habilidadId, nombre',
  });
  const habilidades = catalogo.Items || [];

  const distribucion = [];
  for (const habilidad of habilidades) {
    const resultado = await dynamoDb.query({
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
  // im_postulaciones no tiene GSI sobre estado, por lo que esta métrica se
  // obtiene con una operación puntual (filtrada) sobre esa tabla; no se
  // escanean las demás tablas del sistema.
  const resultado = await dynamoDb.scan({
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
    const resultado = await dynamoDb.query({
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
  for (const estado of ['ACTIVA', 'DESVINCULADA']) {
    const resultado = await dynamoDb.query({
      TableName: tableAsignaciones,
      IndexName: 'GSI3',
      KeyConditionExpression: '#est = :est',
      ExpressionAttributeNames: { '#est': 'estado' },
      ExpressionAttributeValues: { ':est': estado },
    });
    for (const asignacion of resultado.Items || []) {
      const fecha = asignacion.estado === 'DESVINCULADA' ? asignacion.fechaFin : asignacion.fechaAsignacion;
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