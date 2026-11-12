const { exito, creado, error } = require('../../utils/responses');
const { ErrorApp, CODIGOS } = require('../../utils/errors');
const cargosRepository = require('../../repositories/cargos.repository');
const { validarDatos } = require('../../middleware/validation');
const { crearCargoSchema, actualizarCargoSchema } = require('../../utils/validators');
const colaboradoresRepository = require('../../repositories/colaboradores.repository');

function obtenerBody(event) {
  if (!event.body) return {};
  if (typeof event.body === 'string') {
    try {
      const body = JSON.parse(event.body);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ErrorApp('Se requiere un objeto JSON', 400, CODIGOS.VALIDACION);
      }
      return body;
    } catch (e) {
      throw new ErrorApp('JSON inválido', 400, CODIGOS.VALIDACION);
    }
  }
  if (typeof event.body !== 'object' || Array.isArray(event.body) || event.body === null) {
    throw new ErrorApp('Se requiere un objeto JSON', 400, CODIGOS.VALIDACION);
  }
  return event.body;
}

function obtenerPathParam(event, nombre) {
  return event.pathParameters && event.pathParameters[nombre] ? event.pathParameters[nombre] : null;
}

async function crearCargo(event, context) {
  try {
    const body = validarDatos(crearCargoSchema, obtenerBody(event));
    const { cargoId, nombre, descripcion, categoria, estado } = body;

    if (typeof nombre !== 'string' || !nombre.trim()) {
      return error('nombre es requerido', 400, CODIGOS.VALIDACION);
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
    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return error('limit debe ser un entero entre 1 y 100', 400, CODIGOS.VALIDACION);
      }
      filtros.limit = limit;
    }

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

    const cargo = await cargosRepository.actualizar(cargoId, validarDatos(actualizarCargoSchema, data));
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