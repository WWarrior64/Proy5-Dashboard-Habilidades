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
        if (!clave || typeof clave.usuarioId !== 'string' || Array.isArray(clave)) {
          return error('Cursor de paginación inválido', 400, CODIGOS.VALIDACION);
        }
        filtros.lastKey = clave;
      } catch (_) {
        return error('Cursor de paginación inválido', 400, CODIGOS.VALIDACION);
      }
    }

    const resultado = await usuariosRepository.listar(filtros);
    return exito({ ...resultado, nextCursor: resultado.lastKey ? Buffer.from(JSON.stringify(resultado.lastKey)).toString('base64url') : null });
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

    const cognitoSubSolicitante = obtenerCognitoSub(event);
    if (!cognitoSubSolicitante) {
      return error('Identidad Cognito no válida', 401, CODIGOS.NO_AUTORIZADO);
    }

    const solicitante = await usuariosRepository.obtenerPorCognitoSub(cognitoSubSolicitante);
    if (!solicitante || solicitante.estado !== 'ACTIVO') {
      return error('Usuario solicitante inactivo o no registrado', 403, CODIGOS.PROHIBIDO);
    }

    // Solo el propio usuario o un ADMINISTRADOR puede modificar el perfil
    const esPropioPerfil = solicitante.usuarioId === usuarioId;
    const esAdmin = solicitante.rol === 'ADMINISTRADOR';
    if (!esPropioPerfil && !esAdmin) {
      return error('No tiene autorización para modificar este usuario', 403, CODIGOS.PROHIBIDO);
    }

    const body = obtenerBody(event);

    // Política de seguridad: el correo se gestiona en Cognito para evitar desincronizaciones
    if (body.email !== undefined && body.email !== solicitante.email) {
      return error(
        'El correo electrónico no puede modificarse directamente en el perfil; debe actualizarse mediante el flujo de identidad de Cognito',
        400,
        CODIGOS.VALIDACION
      );
    }

    // rol y estado tienen sus endpoints PATCH dedicados con sus propias validaciones
    if (body.rol !== undefined || body.estado !== undefined) {
      return error(
        'Para cambiar rol o estado use los endpoints PATCH correspondientes',
        400,
        CODIGOS.VALIDACION
      );
    }

    const camposPermitidos = ['nombre'];
    const data = {};
    camposPermitidos.forEach((campo) => {
      if (body[campo] !== undefined) {
        data[campo] = typeof body[campo] === 'string' ? body[campo].trim() : body[campo];
      }
    });

    if (data.nombre !== undefined && (!data.nombre || data.nombre.length > 150)) {
      return error('El nombre proporcionado no es válido', 400, CODIGOS.VALIDACION);
    }

    if (Object.keys(data).length === 0) {
      return error('No se proporcionaron campos modificables válidos (ej. nombre)', 400, CODIGOS.VALIDACION);
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