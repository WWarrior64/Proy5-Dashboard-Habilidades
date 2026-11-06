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

const { crearDespachador } = require('../../utils/lambda-dispatcher');

const relaciones = require('../../repositories/proyecto-habilidad.repository');
const handler = crearDespachador({
  'GET /api/v1/proyectos/{proyectoId}/habilidades': async (event) => exito(await relaciones.consultarHabilidadesProyecto(event.pathParameters.proyectoId)),
  'POST /api/v1/proyectos/{proyectoId}/habilidades': async (event) => creado(await relaciones.asociarHabilidad({ ...JSON.parse(event.body), proyectoId: event.pathParameters.proyectoId })),
  'PUT /api/v1/proyectos/{proyectoId}/habilidades/{habilidadId}': async (event) => {
    const body = JSON.parse(event.body);
    const { proyectoId, habilidadId } = event.pathParameters;
    return exito(await relaciones.actualizarRelacion(proyectoId, habilidadId, body));
  },
  'DELETE /api/v1/proyectos/{proyectoId}/habilidades/{habilidadId}': async (event) => exito(await relaciones.eliminarRelacion(event.pathParameters.proyectoId, event.pathParameters.habilidadId)),
  'GET /api/v1/proyectos': listarProyectos,
  'POST /api/v1/proyectos': crearProyecto,
  'GET /api/v1/proyectos/{proyectoId}': obtenerProyecto,
  'PUT /api/v1/proyectos/{proyectoId}': actualizarProyecto,
  'PATCH /api/v1/proyectos/{proyectoId}/estado': cambiarEstadoProyecto,
  'GET /api/v1/proyectos/activos': listarProyectosActivos,
  'DELETE /api/v1/proyectos/{proyectoId}': cancelarProyecto,
});

module.exports = {
  crearProyecto,
  listarProyectos,
  obtenerProyecto,
  actualizarProyecto,
  cambiarEstadoProyecto,
  listarProyectosActivos,
  cancelarProyecto,
  handler,
};