const { exito, creado, error } = require('../../utils/responses');
const { CODIGOS } = require('../../utils/errors');
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

async function crearColaborador(event, context) {
  try {
    const body = obtenerBody(event);
    const { colaboradorId, usuarioId, cargoId, rolProfesional, estado, observaciones } = body;

    if (!colaboradorId || !usuarioId || !cargoId || !rolProfesional) {
      return error('colaboradorId, usuarioId, cargoId y rolProfesional son requeridos', 400, CODIGOS.VALIDACION);
    }

    const colaborador = await colaboradoresRepository.crear({
      colaboradorId,
      usuarioId,
      cargoId,
      rolProfesional,
      estado,
      observaciones,
    });

    return creado(colaborador);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function listarColaboradores(event, context) {
  try {
    const query = event.queryStringParameters || {};
    const filtros = {};
    if (query.estado) filtros.estado = query.estado;
    if (query.cargoId) filtros.cargoId = query.cargoId;
    if (query.rolProfesional) filtros.rolProfesional = query.rolProfesional;
    if (query.limit) filtros.limit = parseInt(query.limit, 10);

    const resultado = await colaboradoresRepository.listar(filtros);
    return exito(resultado);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function obtenerColaborador(event, context) {
  try {
    const colaboradorId = obtenerPathParam(event, 'colaboradorId');
    if (!colaboradorId) {
      return error('colaboradorId es requerido', 400, CODIGOS.VALIDACION);
    }

    const colaborador = await colaboradoresRepository.obtenerPorId(colaboradorId);
    if (!colaborador) {
      return error('Colaborador no encontrado', 404, CODIGOS.NO_ENCONTRADO);
    }

    return exito(colaborador);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function actualizarColaborador(event, context) {
  try {
    const colaboradorId = obtenerPathParam(event, 'colaboradorId');
    if (!colaboradorId) {
      return error('colaboradorId es requerido', 400, CODIGOS.VALIDACION);
    }

    const body = obtenerBody(event);
    const camposPermitidos = ['cargoId', 'rolProfesional', 'estado', 'observaciones'];
    const data = {};
    camposPermitidos.forEach((campo) => {
      if (body[campo] !== undefined) data[campo] = body[campo];
    });

    const colaborador = await colaboradoresRepository.actualizar(colaboradorId, data);
    return exito(colaborador);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function darBajaColaborador(event, context) {
  try {
    const colaboradorId = obtenerPathParam(event, 'colaboradorId');
    if (!colaboradorId) {
      return error('colaboradorId es requerido', 400, CODIGOS.VALIDACION);
    }

    const colaborador = await colaboradoresRepository.darBaja(colaboradorId);
    return exito(colaborador);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

const { crearDespachador } = require('../../utils/lambda-dispatcher');

const relaciones = require('../../repositories/colaborador-habilidad.repository');
const handler = crearDespachador({
  'PATCH /api/v1/colaboradores/{colaboradorId}/estado': async (event) => {
    const body = obtenerBody(event);
    if (typeof body.activo !== 'boolean') return error('activo debe ser booleano', 400, CODIGOS.VALIDACION);
    return exito(await colaboradoresRepository.actualizar(event.pathParameters.colaboradorId, { estado: body.activo ? 'ACTIVO' : 'INACTIVO' }));
  },
  'GET /api/v1/colaboradores/{colaboradorId}/habilidades': async (event) => exito(await relaciones.listarPorColaborador(event.pathParameters.colaboradorId)),
  'POST /api/v1/colaboradores/{colaboradorId}/habilidades': async (event) => creado(await relaciones.asociar({ ...obtenerBody(event), colaboradorId: event.pathParameters.colaboradorId })),
  'PUT /api/v1/colaboradores/{colaboradorId}/habilidades/{habilidadId}': async (event) => exito(await relaciones.actualizarNivel(event.pathParameters.colaboradorId, event.pathParameters.habilidadId, obtenerBody(event))),
  'DELETE /api/v1/colaboradores/{colaboradorId}/habilidades/{habilidadId}': async (event) => exito(await relaciones.retirar(event.pathParameters.colaboradorId, event.pathParameters.habilidadId)),
  'GET /api/v1/colaboradores': listarColaboradores,
  'POST /api/v1/colaboradores': crearColaborador,
  'GET /api/v1/colaboradores/{colaboradorId}': obtenerColaborador,
  'PUT /api/v1/colaboradores/{colaboradorId}': actualizarColaborador,
  'DELETE /api/v1/colaboradores/{colaboradorId}': darBajaColaborador,
});

module.exports = {
  crearColaborador,
  listarColaboradores,
  obtenerColaborador,
  actualizarColaborador,
  darBajaColaborador,
  handler,
};