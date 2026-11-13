const { exito, creado, error } = require('../../utils/responses');
const { ErrorApp, CODIGOS } = require('../../utils/errors');
const colaboradoresRepository = require('../../repositories/colaboradores.repository');
const { validarDatos } = require('../../middleware/validation');
const { crearColaboradorSchema, actualizarColaboradorSchema, asociarHabilidadSchema, actualizarNivelHabilidadSchema } = require('../../utils/validators');

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

async function crearColaborador(event, context) {
  try {
    const body = validarDatos(crearColaboradorSchema, obtenerBody(event));
    const { colaboradorId, usuarioId, cargoId, rolProfesional, nombre, estado, observaciones } = body;

    if (!usuarioId || !cargoId || !rolProfesional) {
      return error('usuarioId, cargoId y rolProfesional son requeridos', 400, CODIGOS.VALIDACION);
    }

    const colaborador = await colaboradoresRepository.crear({
      colaboradorId,
      usuarioId,
      cargoId,
      rolProfesional,
      nombre,
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
    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return error('limit debe ser un entero entre 1 y 100', 400, CODIGOS.VALIDACION);
      }
      filtros.limit = limit;
    }

    if (query.cursor !== undefined) {
      if (typeof query.cursor !== 'string' || query.cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(query.cursor)) {
        return error('Cursor de paginación inválido', 400, CODIGOS.VALIDACION);
      }
      try {
        const clave = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
        if (!clave || typeof clave.colaboradorId !== 'string' || !clave.colaboradorId || Array.isArray(clave)) {
          return error('Cursor de paginación inválido', 400, CODIGOS.VALIDACION);
        }
        filtros.lastKey = clave;
      } catch (_) {
        return error('Cursor de paginación inválido', 400, CODIGOS.VALIDACION);
      }
    }
    const resultado = await colaboradoresRepository.listar(filtros);
    return exito({ ...resultado, nextCursor: resultado.lastKey ? Buffer.from(JSON.stringify(resultado.lastKey)).toString('base64url') : null });
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

async function obtenerMiColaborador(event) {
  try {
    const usuarioId = event.usuarioAutenticado?.usuarioId;
    if (!usuarioId) return error('Autenticación requerida', 401, CODIGOS.NO_AUTORIZADO);
    const colaborador = await colaboradoresRepository.obtenerPorUsuarioId(usuarioId);
    if (!colaborador) return error('El usuario no tiene un perfil de colaborador', 404, CODIGOS.NO_ENCONTRADO);
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

    const colaborador = await colaboradoresRepository.actualizar(colaboradorId, validarDatos(actualizarColaboradorSchema, data));
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
  'POST /api/v1/colaboradores/{colaboradorId}/habilidades': async (event) => creado(await relaciones.asociar(validarDatos(asociarHabilidadSchema, { ...obtenerBody(event), colaboradorId: event.pathParameters.colaboradorId }))),
  'PUT /api/v1/colaboradores/{colaboradorId}/habilidades/{habilidadId}': async (event) => exito(await relaciones.actualizarNivel(event.pathParameters.colaboradorId, event.pathParameters.habilidadId, validarDatos(actualizarNivelHabilidadSchema, obtenerBody(event)))),
  'DELETE /api/v1/colaboradores/{colaboradorId}/habilidades/{habilidadId}': async (event) => exito(await relaciones.retirar(event.pathParameters.colaboradorId, event.pathParameters.habilidadId)),
  'GET /api/v1/colaboradores': listarColaboradores,
  'GET /api/v1/colaboradores/yo': obtenerMiColaborador,
  'POST /api/v1/colaboradores': crearColaborador,
  'GET /api/v1/colaboradores/{colaboradorId}': obtenerColaborador,
  'PUT /api/v1/colaboradores/{colaboradorId}': actualizarColaborador,
  'DELETE /api/v1/colaboradores/{colaboradorId}': darBajaColaborador,
});

module.exports = {
  crearColaborador,
  listarColaboradores,
  obtenerColaborador,
  obtenerMiColaborador,
  actualizarColaborador,
  darBajaColaborador,
  handler,
};