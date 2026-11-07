const { exito, creado, error } = require('../../utils/responses');
const { CODIGOS } = require('../../utils/errors');
const usuariosRepository = require('../../repositories/usuarios.repository');
const { resolverIdentidad } = require('../../services/cognito-admin.service');

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
    const cognitoSubSolicitante = obtenerCognitoSub(event);
    if (!cognitoSubSolicitante) return error('Identidad Cognito no válida', 401, CODIGOS.NO_AUTORIZADO);
    const administrador = await usuariosRepository.obtenerPorCognitoSub(cognitoSubSolicitante);
    if (!administrador || administrador.estado !== 'ACTIVO' || administrador.rol !== 'ADMINISTRADOR') {
      return error('Solo un administrador activo puede registrar usuarios', 403, CODIGOS.PROHIBIDO);
    }

    const body = obtenerBody(event);
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rol = body.rol || 'EMPLEADO';
    if (!nombre || nombre.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return error('Nombre y correo electrónico válidos son requeridos', 400, CODIGOS.VALIDACION);
    }
    if (!ROLES_VALIDOS.includes(rol)) {
      return error(`Rol inválido. Valores permitidos: ${ROLES_VALIDOS.join(', ')}`, 400, CODIGOS.VALIDACION);
    }
    // Nunca se acepta cognitoSub desde el navegador: lo resuelve Cognito en AWS.
    const { cognitoSub, creadoEnCognito } = await resolverIdentidad({ email, nombre });
    const usuarioId = `usr_${require('crypto').randomUUID()}`;
    try {
      const usuario = await usuariosRepository.crear({ usuarioId, cognitoSub, nombre, email, rol, estado: 'ACTIVO' });
      return creado({ ...usuario, invitacionEnviada: creadoEnCognito });
    } catch (e) {
      if (creadoEnCognito) {
        // La cuenta en Cognito permanece para permitir reintentar el vínculo sin duplicarla.
        return error('La cuenta Cognito fue creada, pero no se pudo vincular con DynamoDB. Reintente el registro con el mismo correo. Detalle: ' + (e.codigo === 409 ? e.message : 'error de persistencia'), e.codigo === 409 ? 409 : 500, e.codigoError || CODIGOS.INTERNO);
      }
      throw e;
    }
  } catch (err) {
    return error(err.message || 'No fue posible crear el usuario', err.codigo || 500, err.codigoError || CODIGOS.INTERNO);
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

const { crearDespachador } = require('../../utils/lambda-dispatcher');

const handler = crearDespachador({
  'GET /api/v1/usuarios': listarUsuarios,
  'POST /api/v1/usuarios': crearUsuario,
  'GET /api/v1/usuarios/{usuarioId}': obtenerUsuario,
  'PUT /api/v1/usuarios/{usuarioId}': actualizarUsuario,
  'PATCH /api/v1/usuarios/{usuarioId}/rol': cambiarRol,
  'PATCH /api/v1/usuarios/{usuarioId}/estado': cambiarEstado,
  'GET /api/v1/usuarios/yo': obtenerPerfil,
});

module.exports = {
  obtenerUsuario,
  obtenerPerfil,
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarRol,
  cambiarEstado,
  handler,
};