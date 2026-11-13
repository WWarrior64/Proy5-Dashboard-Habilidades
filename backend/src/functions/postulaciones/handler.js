const { exito, creado, error } = require('../../utils/responses.js');
const { ErrorApp, CODIGOS } = require('../../utils/errors.js');
const postulacionesRepo = require('../../repositories/postulaciones.repository.js');

function obtenerBody(event) {
  if (!event.body) return {};
  if (typeof event.body === 'string') {
    try {
      const body = JSON.parse(event.body);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ErrorApp('Se requiere un objeto JSON', 400, CODIGOS.VALIDACION);
      }
      return body;
    } catch (_) {
      throw new ErrorApp('JSON inválido', 400, CODIGOS.VALIDACION);
    }
  }
  if (typeof event.body !== 'object' || Array.isArray(event.body)) {
    throw new ErrorApp('Se requiere un objeto JSON', 400, CODIGOS.VALIDACION);
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
  console.error('Error no controlado en postulaciones', { tipo: e.name, mensaje: e.message });
  return error('Error interno del servidor', 500, CODIGOS.INTERNO);
}

async function crearPostulacion(event, context) {
  try {
    const datos = obtenerBody(event);
    const postulacion = await postulacionesRepo.crearPostulacion(datos);
    return creado(postulacion);
  } catch (e) {
    return responderError(e);
  }
}

async function consultarPostulacionesProyecto(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    if (!proyectoId) {
      throw new ErrorApp('Se requiere el parámetro proyectoId', 400, CODIGOS.VALIDACION);
    }
    const postulaciones = await postulacionesRepo.consultarPostulacionesProyecto(proyectoId);
    return exito(postulaciones);
  } catch (e) {
    return responderError(e);
  }
}

async function consultarPostulacionesColaborador(event, context) {
  try {
    const colaboradorId = obtenerParametro(event, 'colaboradorId');
    if (!colaboradorId) {
      throw new ErrorApp('Se requiere el parámetro colaboradorId', 400, CODIGOS.VALIDACION);
    }
    const postulaciones = await postulacionesRepo.consultarPostulacionesColaborador(colaboradorId);
    return exito(postulaciones);
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerPostulacion(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    const colaboradorId = obtenerParametro(event, 'colaboradorId');
    if (!proyectoId || !colaboradorId) {
      throw new ErrorApp('Se requieren los parámetros proyectoId y colaboradorId', 400, CODIGOS.VALIDACION);
    }
    const postulacion = await postulacionesRepo.obtenerPostulacion(proyectoId, colaboradorId);
    return exito(postulacion);
  } catch (e) {
    return responderError(e);
  }
}

async function aceptarPostulacion(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    const colaboradorId = obtenerParametro(event, 'colaboradorId');
    if (!proyectoId || !colaboradorId) {
      throw new ErrorApp('Se requieren los parámetros proyectoId y colaboradorId', 400, CODIGOS.VALIDACION);
    }
    const datosRevision = obtenerBody(event);
    const resultado = await postulacionesRepo.aceptarPostulacion(proyectoId, colaboradorId, datosRevision);
    return exito(resultado);
  } catch (e) {
    return responderError(e);
  }
}

async function rechazarPostulacion(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    const colaboradorId = obtenerParametro(event, 'colaboradorId');
    if (!proyectoId || !colaboradorId) {
      throw new ErrorApp('Se requieren los parámetros proyectoId y colaboradorId', 400, CODIGOS.VALIDACION);
    }
    const datosRevision = obtenerBody(event);
    const postulacion = await postulacionesRepo.rechazarPostulacion(proyectoId, colaboradorId, datosRevision);
    return exito(postulacion);
  } catch (e) {
    return responderError(e);
  }
}

async function retirarPostulacion(event, context) {
  try {
    const proyectoId = obtenerParametro(event, 'proyectoId');
    const colaboradorId = obtenerParametro(event, 'colaboradorId');
    if (!proyectoId || !colaboradorId) {
      throw new ErrorApp('Se requieren los parámetros proyectoId y colaboradorId', 400, CODIGOS.VALIDACION);
    }
    const datosRevision = obtenerBody(event);
    const postulacion = await postulacionesRepo.retirarPostulacion(proyectoId, colaboradorId, datosRevision);
    return exito(postulacion);
  } catch (e) {
    return responderError(e);
  }
}

const { crearDespachador } = require('../../utils/lambda-dispatcher');

const handler = crearDespachador({
  'PATCH /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}/retirar': retirarPostulacion,
  'POST /api/v1/postulaciones': crearPostulacion,
  'GET /api/v1/proyectos/{proyectoId}/postulaciones': consultarPostulacionesProyecto,
  'GET /api/v1/colaboradores/{colaboradorId}/postulaciones': consultarPostulacionesColaborador,
  'GET /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}': obtenerPostulacion,
  'PATCH /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}/estado': (event, context) => {
    try {
      const { estado } = obtenerBody(event);
      if (estado === 'ACEPTADA') return aceptarPostulacion(event, context);
      if (estado === 'RETIRADA') return retirarPostulacion(event, context);
      if (estado === 'RECHAZADA') return rechazarPostulacion(event, context);
      return error('Estado no válido', 400, CODIGOS.VALIDACION);
    } catch (e) {
      return responderError(e);
    }
  },
});

module.exports = {
  crearPostulacion,
  consultarPostulacionesProyecto,
  consultarPostulacionesColaborador,
  obtenerPostulacion,
  aceptarPostulacion,
  rechazarPostulacion,
  retirarPostulacion,
  handler,
};