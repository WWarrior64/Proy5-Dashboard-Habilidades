const { error } = require('../utils/responses');
const { CODIGOS } = require('../utils/errors');
const usuariosRepository = require('../repositories/usuarios.repository');

/**
 * Middleware de autenticación para handlers de Lambda (API Gateway).
 * Verifica la identidad proveniente de Cognito y que el usuario exista y esté activo.
 * Adjunta el usuario autenticado a event.usuarioAutenticado.
 *
 * @param {Object} event - Evento de API Gateway Lambda proxy.
 * @param {Function} handler - Handler Lambda original.
 * @returns {Promise<Object>} Respuesta Lambda.
 */
async function autenticar(event, handler) {
  try {
    const requestContext = event.requestContext || {};
    const authorizer = requestContext.authorizer || {};
    const claims = authorizer.claims || authorizer.jwt || {};
    const cognitoSub = claims.sub || claims.cognito_sub || null;

    if (!cognitoSub) {
      return error('Identidad de Cognito no válida', 401, CODIGOS.NO_AUTORIZADO);
    }

    const usuario = await usuariosRepository.obtenerPorCognitoSub(cognitoSub);
    if (!usuario) {
      return error('Usuario no encontrado en el sistema interno', 401, CODIGOS.NO_AUTORIZADO);
    }

    if (usuario.estado !== 'ACTIVO') {
      return error('La cuenta del usuario no está activa', 403, CODIGOS.PROHIBIDO);
    }

    event.usuarioAutenticado = usuario;
    return await handler(event, {});
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

module.exports = { autenticar };