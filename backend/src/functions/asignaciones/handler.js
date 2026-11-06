const { exito, creado, error } = require('../../utils/responses.js');
const { ErrorApp, CODIGOS } = require('../../utils/errors.js');
const asignacionesRepo = require('../../repositories/asignaciones.repository.js');

function obtenerBody(event) {
  if (!event.body) return {};
  if (typeof event.body === 'string') {
    try {
      return JSON.parse(event.body);
    } catch (_) {
      return {};
    }
  }
  return event.body;
}

function obtenerParametro(event, nombre) {
  const path = event.pathParameters || {};
  const query = event.queryStringParameters || {};
  if (Object.prototype.hasOwnProperty.call(path, nombre) && path[nombre] !== undefined) {
    return path[nombre];
  }
  return query[nombre];
}

function responderError(e) {
  if (e instanceof ErrorApp) return error(e.message, e.codigo, e.codigoError);
  return error(e.message || 'Error interno del servidor', 500, CODIGOS.INTERNO);
}

async function crearAsignacion(event, context) {
  try {
    const datos = obtenerBody(event);
    const asignacion = await asignacionesRepo.crearAsignacion(datos);
    return creado(asignacion);
  } catch (e) {
    return responderError(e);
  }
}

async function listarAsignacionesActivas(event, context) {
  try {
    const asignaciones = await asignacionesRepo.listarAsignacionesActivas();
    return exito(asignaciones);
  } catch (e) {
    return responderError(e);
  }
}

async function listarAsignacionesColaborador(event, context) {
  try {
    const colaboradorId = obtenerParametro(event, 'colaboradorId');
    if (!colaboradorId) {
      throw new ErrorApp('Se requiere el parámetro colaboradorId', 400, CODIGOS.VALIDACION);
    }
    const asignaciones = await asignacionesRepo.listarAsignacionesColaborador(colaboradorId);
    return exito(asignaciones);
  } catch (e) {
    return responderError(e);
  }
}

async function listarAsignacionesProyecto(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    if (!proyectoId) {
      throw new ErrorApp('Se requiere el parámetro proyectoId', 400, CODIGOS.VALIDACION);
    }
    const asignaciones = await asignacionesRepo.listarAsignacionesProyecto(proyectoId);
    return exito(asignaciones);
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerAsignacion(event, context) {
  try {
    const asignacionId = obtenerParametro(event, 'asignacionId');
    if (!asignacionId) {
      throw new ErrorApp('Se requiere el parámetro asignacionId', 400, CODIGOS.VALIDACION);
    }
    const asignacion = await asignacionesRepo.obtenerAsignacion(asignacionId);
    return exito(asignacion);
  } catch (e) {
    return responderError(e);
  }
}

async function actualizarAsignacion(event, context) {
  try {
    const asignacionId = obtenerParametro(event, 'asignacionId');
    if (!asignacionId) {
      throw new ErrorApp('Se requiere el parámetro asignacionId', 400, CODIGOS.VALIDACION);
    }
    const cambios = obtenerBody(event);
    const asignacion = await asignacionesRepo.actualizarAsignacion(asignacionId, cambios);
    return exito(asignacion);
  } catch (e) {
    return responderError(e);
  }
}

async function desvincularAsignacion(event, context) {
  try {
    const asignacionId = obtenerParametro(event, 'asignacionId');
    if (!asignacionId) {
      throw new ErrorApp('Se requiere el parámetro asignacionId', 400, CODIGOS.VALIDACION);
    }
    const asignacion = await asignacionesRepo.desvincularAsignacion(asignacionId);
    return exito(asignacion);
  } catch (e) {
    return responderError(e);
  }
}

const { crearDespachador } = require('../../utils/lambda-dispatcher');

const handler = crearDespachador({
  'GET /api/v1/asignaciones': listarAsignacionesActivas,
  'POST /api/v1/asignaciones': crearAsignacion,
  'GET /api/v1/asignaciones/{asignacionId}': obtenerAsignacion,
  'PUT /api/v1/asignaciones/{asignacionId}': actualizarAsignacion,
  'DELETE /api/v1/asignaciones/{asignacionId}': desvincularAsignacion,
  'GET /api/v1/colaboradores/{colaboradorId}/asignaciones': listarAsignacionesColaborador,
  'GET /api/v1/proyectos/{proyectoId}/asignaciones': listarAsignacionesProyecto,
});

module.exports = {
  crearAsignacion,
  listarAsignacionesActivas,
  listarAsignacionesColaborador,
  listarAsignacionesProyecto,
  obtenerAsignacion,
  actualizarAsignacion,
  desvincularAsignacion,
  handler,
};