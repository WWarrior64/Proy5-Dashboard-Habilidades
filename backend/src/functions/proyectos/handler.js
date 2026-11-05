const { exito, creado, error } = require('../../utils/responses.js');
const { ErrorApp, CODIGOS } = require('../../utils/errors.js');
const proyectosRepo = require('../../repositories/proyectos.repository.js');

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

async function crearProyecto(event, context) {
  try {
    const datos = obtenerBody(event);
    const proyecto = await proyectosRepo.crearProyecto(datos);
    return creado(proyecto);
  } catch (e) {
    return responderError(e);
  }
}

async function listarProyectos(event, context) {
  try {
    const query = event.queryStringParameters || {};
    const filtros = {};
    if (query.estado) filtros.estado = query.estado;
    if (query.liderId) filtros.liderId = query.liderId;
    if (query.fecha) filtros.fecha = query.fecha;
    const proyectos = await proyectosRepo.listarProyectos(filtros);
    return exito(proyectos);
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerProyecto(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    if (!proyectoId) {
      throw new ErrorApp('Se requiere el parámetro proyectoId', 400, CODIGOS.VALIDACION);
    }
    const proyecto = await proyectosRepo.obtenerProyecto(proyectoId);
    return exito(proyecto);
  } catch (e) {
    return responderError(e);
  }
}

async function actualizarProyecto(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    if (!proyectoId) {
      throw new ErrorApp('Se requiere el parámetro proyectoId', 400, CODIGOS.VALIDACION);
    }
    const cambios = obtenerBody(event);
    const proyecto = await proyectosRepo.actualizarProyecto(proyectoId, cambios);
    return exito(proyecto);
  } catch (e) {
    return responderError(e);
  }
}

async function cambiarEstadoProyecto(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    if (!proyectoId) {
      throw new ErrorApp('Se requiere el parámetro proyectoId', 400, CODIGOS.VALIDACION);
    }
    const body = obtenerBody(event);
    if (!body.estado) {
      throw new ErrorApp('Se requiere el campo estado', 400, CODIGOS.VALIDACION);
    }
    const proyecto = await proyectosRepo.cambiarEstado(proyectoId, body.estado);
    return exito(proyecto);
  } catch (e) {
    return responderError(e);
  }
}

async function listarProyectosActivos(event, context) {
  try {
    const proyectos = await proyectosRepo.listarProyectosActivos();
    return exito(proyectos);
  } catch (e) {
    return responderError(e);
  }
}

async function cancelarProyecto(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    if (!proyectoId) {
      throw new ErrorApp('Se requiere el parámetro proyectoId', 400, CODIGOS.VALIDACION);
    }
    const proyecto = await proyectosRepo.cancelarProyecto(proyectoId);
    return exito(proyecto);
  } catch (e) {
    return responderError(e);
  }
}

module.exports = {
  crearProyecto,
  listarProyectos,
  obtenerProyecto,
  actualizarProyecto,
  cambiarEstadoProyecto,
  listarProyectosActivos,
  cancelarProyecto,
};