const { exito, creado, error } = require('../../utils/responses');
const { ErrorApp, CODIGOS } = require('../../utils/errors');
const habilidadesRepository = require('../../repositories/habilidades.repository');
const { validarDatos } = require('../../middleware/validation');
const { crearHabilidadSchema, actualizarHabilidadSchema } = require('../../utils/validators');

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

async function crearHabilidad(event, context) {
  try {
    const body = validarDatos(crearHabilidadSchema, obtenerBody(event));
    const { habilidadId, nombre, categoria, descripcion, estado } = body;

    if (typeof nombre !== 'string' || !nombre.trim()) {
      return error('nombre es requerido', 400, CODIGOS.VALIDACION);
    }

    const habilidad = await habilidadesRepository.crear({
      habilidadId,
      nombre,
      categoria,
      descripcion,
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
    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return error('limit debe ser un entero entre 1 y 100', 400, CODIGOS.VALIDACION);
      }
      filtros.limit = limit;
    }

    const resultado = await habilidadesRepository.listar(filtros);
    return exito(resultado);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function listarCategorias() {
  try {
    const categorias = new Set();
    let lastKey;
    do {
      const pagina = await habilidadesRepository.listar({ limit: 100, lastKey });
      for (const habilidad of pagina.items) categorias.add(habilidad.categoria || 'GENERAL');
      lastKey = pagina.lastKey;
    } while (lastKey);
    return exito([...categorias].sort((a, b) => a.localeCompare(b, 'es')));
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
    const camposPermitidos = ['nombre', 'categoria', 'descripcion', 'estado'];
    const data = {};
    camposPermitidos.forEach((campo) => {
      if (body[campo] !== undefined) data[campo] = body[campo];
    });

    const habilidad = await habilidadesRepository.actualizar(habilidadId, validarDatos(actualizarHabilidadSchema, data));
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
  'GET /api/v1/habilidades/categorias': listarCategorias,
  'POST /api/v1/habilidades': crearHabilidad,
  'GET /api/v1/habilidades/{habilidadId}': obtenerHabilidad,
  'PUT /api/v1/habilidades/{habilidadId}': actualizarHabilidad,
  'PATCH /api/v1/habilidades/{habilidadId}/estado': cambiarEstadoHabilidad,
});

module.exports = {
  crearHabilidad,
  listarHabilidades,
  listarCategorias,
  obtenerHabilidad,
  actualizarHabilidad,
  cambiarEstadoHabilidad,
  handler,
};