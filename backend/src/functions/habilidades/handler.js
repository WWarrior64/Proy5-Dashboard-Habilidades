const { exito, creado, error } = require('../../utils/responses');
const { CODIGOS } = require('../../utils/errors');
const habilidadesRepository = require('../../repositories/habilidades.repository');

function obtenerBody(event) {
  if (!event.body) return {};
  if (typeof event.body === 'string') {
    try {
      return JSON.parse(event.body);
    } catch (e) {
      return {};
    }
  }
  return event.body;
}

function obtenerPathParam(event, nombre) {
  return event.pathParameters && event.pathParameters[nombre] ? event.pathParameters[nombre] : null;
}

async function crearHabilidad(event, context) {
  try {
    const body = obtenerBody(event);
    const { habilidadId, nombre, categoria, estado } = body;

    if (!habilidadId || !nombre) {
      return error('habilidadId y nombre son requeridos', 400, CODIGOS.VALIDACION);
    }

    const habilidad = await habilidadesRepository.crear({
      habilidadId,
      nombre,
      categoria,
      estado,
    });

    return creado(habilidad);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function listarHabilidades(event, context) {
  try {
    const query = event.queryStringParameters || {};
    const filtros = {};
    if (query.categoria) filtros.categoria = query.categoria;
    if (query.nombre) filtros.nombre = query.nombre;
    if (query.estado) filtros.estado = query.estado;
    if (query.limit) filtros.limit = parseInt(query.limit, 10);

    const resultado = await habilidadesRepository.listar(filtros);
    return exito(resultado);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function obtenerHabilidad(event, context) {
  try {
    const habilidadId = obtenerPathParam(event, 'habilidadId');
    if (!habilidadId) {
      return error('habilidadId es requerido', 400, CODIGOS.VALIDACION);
    }

    const habilidad = await habilidadesRepository.obtenerPorId(habilidadId);
    if (!habilidad) {
      return error('Habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
    }

    return exito(habilidad);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function actualizarHabilidad(event, context) {
  try {
    const habilidadId = obtenerPathParam(event, 'habilidadId');
    if (!habilidadId) {
      return error('habilidadId es requerido', 400, CODIGOS.VALIDACION);
    }

    const body = obtenerBody(event);
    const camposPermitidos = ['nombre', 'categoria', 'estado'];
    const data = {};
    camposPermitidos.forEach((campo) => {
      if (body[campo] !== undefined) data[campo] = body[campo];
    });

    const habilidad = await habilidadesRepository.actualizar(habilidadId, data);
    return exito(habilidad);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function cambiarEstadoHabilidad(event, context) {
  try {
    const habilidadId = obtenerPathParam(event, 'habilidadId');
    if (!habilidadId) {
      return error('habilidadId es requerido', 400, CODIGOS.VALIDACION);
    }

    const body = obtenerBody(event);
    if (typeof body.activo !== 'boolean') {
      return error('El campo activo es requerido (booleano)', 400, CODIGOS.VALIDACION);
    }

    const habilidad = await habilidadesRepository.cambiarEstado(habilidadId, body.activo);
    return exito(habilidad);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

const { crearDespachador } = require('../../utils/lambda-dispatcher');

const handler = crearDespachador({
  'GET /api/v1/habilidades': listarHabilidades,
  'POST /api/v1/habilidades': crearHabilidad,
  'GET /api/v1/habilidades/{habilidadId}': obtenerHabilidad,
  'PUT /api/v1/habilidades/{habilidadId}': actualizarHabilidad,
  'PATCH /api/v1/habilidades/{habilidadId}/estado': cambiarEstadoHabilidad,
});

module.exports = {
  crearHabilidad,
  listarHabilidades,
  obtenerHabilidad,
  actualizarHabilidad,
  cambiarEstadoHabilidad,
  handler,
};