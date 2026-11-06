const { exito, creado, error } = require('../../utils/responses');
const { CODIGOS } = require('../../utils/errors');
const cargosRepository = require('../../repositories/cargos.repository');
const colaboradoresRepository = require('../../repositories/colaboradores.repository');

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

async function crearCargo(event, context) {
  try {
    const body = obtenerBody(event);
    const { cargoId, nombre, descripcion, categoria, estado } = body;

    if (!cargoId || !nombre) {
      return error('cargoId y nombre son requeridos', 400, CODIGOS.VALIDACION);
    }

    const cargo = await cargosRepository.crear({
      cargoId,
      nombre,
      descripcion,
      categoria,
      estado,
    });

    return creado(cargo);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function listarCargos(event, context) {
  try {
    const query = event.queryStringParameters || {};
    const filtros = {};
    if (query.estado) filtros.estado = query.estado;
    if (query.limit) filtros.limit = parseInt(query.limit, 10);

    const resultado = await cargosRepository.listar(filtros);
    return exito(resultado);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function obtenerCargo(event, context) {
  try {
    const cargoId = obtenerPathParam(event, 'cargoId');
    if (!cargoId) {
      return error('cargoId es requerido', 400, CODIGOS.VALIDACION);
    }

    const cargo = await cargosRepository.obtenerPorId(cargoId);
    if (!cargo) {
      return error('Cargo no encontrado', 404, CODIGOS.NO_ENCONTRADO);
    }

    return exito(cargo);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function actualizarCargo(event, context) {
  try {
    const cargoId = obtenerPathParam(event, 'cargoId');
    if (!cargoId) {
      return error('cargoId es requerido', 400, CODIGOS.VALIDACION);
    }

    const body = obtenerBody(event);
    const camposPermitidos = ['nombre', 'descripcion', 'categoria'];
    const data = {};
    camposPermitidos.forEach((campo) => {
      if (body[campo] !== undefined) data[campo] = body[campo];
    });

    const cargo = await cargosRepository.actualizar(cargoId, data);
    return exito(cargo);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function cambiarEstadoCargo(event, context) {
  try {
    const cargoId = obtenerPathParam(event, 'cargoId');
    if (!cargoId) {
      return error('cargoId es requerido', 400, CODIGOS.VALIDACION);
    }

    const body = obtenerBody(event);
    if (typeof body.activo !== 'boolean') {
      return error('El campo activo es requerido (booleano)', 400, CODIGOS.VALIDACION);
    }

    if (!body.activo) {
      const tieneAsociados = await cargosRepository.tieneColaboradoresAsociados(cargoId);
      if (tieneAsociados) {
        return error('No se puede desactivar un cargo con colaboradores asociados', 400, CODIGOS.VALIDACION);
      }
    }

    const cargo = await cargosRepository.cambiarEstado(cargoId, body.activo);
    return exito(cargo);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

const { crearDespachador } = require('../../utils/lambda-dispatcher');

const handler = crearDespachador({
  'GET /api/v1/cargos': listarCargos,
  'POST /api/v1/cargos': crearCargo,
  'GET /api/v1/cargos/{cargoId}': obtenerCargo,
  'PUT /api/v1/cargos/{cargoId}': actualizarCargo,
  'PATCH /api/v1/cargos/{cargoId}/estado': cambiarEstadoCargo,
});

module.exports = {
  crearCargo,
  listarCargos,
  obtenerCargo,
  actualizarCargo,
  cambiarEstadoCargo,
  handler,
};