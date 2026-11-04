const { exito, creado, error } = require('../../utils/responses');
const { CODIGOS } = require('../../utils/errors');
const usuariosRepository = require('../../repositories/usuarios.repository');

const ROLES_VALIDOS = ['EMPLEADO', 'RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'];

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

function obtenerCognitoSub(event) {
  const requestContext = event.requestContext || {};
  const authorizer = requestContext.authorizer || {};
  const claims = authorizer.claims || authorizer.jwt || {};
  return claims.sub || claims.cognito_sub || null;
}

async function obtenerUsuario(event, context) {
  try {
    const usuarioId = obtenerPathParam(event, 'usuarioId');
    if (!usuarioId) {
      return error('usuarioId es requerido', 400, CODIGOS.VALIDACION);
    }

    const usuario = await usuariosRepository.obtenerPorId(usuarioId);
    if (!usuario) {
      return error('Usuario no encontrado', 404, CODIGOS.NO_ENCONTRADO);
    }

    return exito(usuario);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function obtenerPerfil(event, context) {
  try {
    const cognitoSub = obtenerCognitoSub(event);
    if (!cognitoSub) {
      return error('Identidad de Cognito no válida', 401, CODIGOS.NO_AUTORIZADO);
    }

    const usuario = await usuariosRepository.obtenerPorCognitoSub(cognitoSub);
    if (!usuario) {
      return error('Usuario no encontrado', 404, CODIGOS.NO_ENCONTRADO);
    }
    if (usuario.estado !== 'ACTIVO') {
      return error('La cuenta del usuario no está activa', 403, CODIGOS.PROHIBIDO);
    }

    return exito(usuario);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function listarUsuarios(event, context) {
  try {
    const query = event.queryStringParameters || {};
    const filtros = {};
    if (query.rol) filtros.rol = query.rol;
    if (query.estado) filtros.estado = query.estado;
    if (query.limit) filtros.limit = parseInt(query.limit, 10);

    const resultado = await usuariosRepository.listar(filtros);
    return exito(resultado);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function crearUsuario(event, context) {
  try {
    const body = obtenerBody(event);
    const { cognitoSub, nombre, email, rol } = body;

    if (!cognitoSub || !nombre || !email) {
      return error('cognitoSub, nombre y email son requeridos', 400, CODIGOS.VALIDACION);
    }

    if (rol && !ROLES_VALIDOS.includes(rol)) {
      return error(`Rol inválido. Valores permitidos: ${ROLES_VALIDOS.join(', ')}`, 400, CODIGOS.VALIDACION);
    }

    const usuarioId = body.usuarioId || `usr_${Date.now()}`;

    const usuario = await usuariosRepository.crear({
      usuarioId,
      cognitoSub,
      nombre,
      email,
      rol: rol || 'EMPLEADO',
      estado: 'ACTIVO',
    });

    return creado(usuario);
  } catch (err) {
    if (err.codigoError === 'CONFLICT') {
      return error('Ya existe un usuario con ese ID', 409, CODIGOS.CONFLICTO);
    }
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function actualizarUsuario(event, context) {
  try {
    const usuarioId = obtenerPathParam(event, 'usuarioId');
    if (!usuarioId) {
      return error('usuarioId es requerido', 400, CODIGOS.VALIDACION);
    }

    const body = obtenerBody(event);
    const camposPermitidos = ['nombre', 'email', 'rol', 'estado'];
    const data = {};
    camposPermitidos.forEach((campo) => {
      if (body[campo] !== undefined) data[campo] = body[campo];
    });

    if (data.rol && !ROLES_VALIDOS.includes(data.rol)) {
      return error(`Rol inválido. Valores permitidos: ${ROLES_VALIDOS.join(', ')}`, 400, CODIGOS.VALIDACION);
    }

    const usuario = await usuariosRepository.actualizar(usuarioId, data);
    return exito(usuario);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function cambiarRol(event, context) {
  try {
    const usuarioId = obtenerPathParam(event, 'usuarioId');
    if (!usuarioId) {
      return error('usuarioId es requerido', 400, CODIGOS.VALIDACION);
    }

    const body = obtenerBody(event);
    if (!body.rol || !ROLES_VALIDOS.includes(body.rol)) {
      return error(`Rol inválido o requerido. Valores permitidos: ${ROLES_VALIDOS.join(', ')}`, 400, CODIGOS.VALIDACION);
    }

    const usuario = await usuariosRepository.cambiarRol(usuarioId, body.rol);
    return exito(usuario);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function cambiarEstado(event, context) {
  try {
    const usuarioId = obtenerPathParam(event, 'usuarioId');
    if (!usuarioId) {
      return error('usuarioId es requerido', 400, CODIGOS.VALIDACION);
    }

    const body = obtenerBody(event);
    if (typeof body.activo !== 'boolean') {
      return error('El campo activo es requerido (booleano)', 400, CODIGOS.VALIDACION);
    }

    const usuario = await usuariosRepository.cambiarEstado(usuarioId, body.activo);
    return exito(usuario);
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

module.exports = {
  obtenerUsuario,
  obtenerPerfil,
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarRol,
  cambiarEstado,
};