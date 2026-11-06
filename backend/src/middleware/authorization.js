const { error } = require('../utils/responses');
const { CODIGOS } = require('../utils/errors');

const ROLES_ADMIN = ['ADMINISTRADOR', 'RRHH'];

/**
 * Middleware de autorización para handlers de Lambda.
 * Restringe operaciones según el rol del usuario autenticado.
 *
 * Uso: authorization.autorizar('ADMINISTRADOR')(event, handler)
 *      o authorization.autorizar(['ADMINISTRADOR', 'RRHH'])(event, handler)
 *
 * @param {string|Array} rolesPermitidos - Rol o lista de roles permitidos.
 * @returns {Function} Función que recibe (event, handler) y ejecuta el handler si está autorizado.
 */
function autorizar(rolesPermitidos) {
  const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];

  return async function (event, handler) {
    try {
      const usuario = event.usuarioAutenticado;
      if (!usuario) {
        return error('Autenticación requerida', 401, CODIGOS.NO_AUTORIZADO);
      }

      const rolUsuario = usuario.rol;

      if (!roles.includes(rolUsuario)) {
        return error('Permisos insuficientes para esta operación', 403, CODIGOS.PROHIBIDO);
      }

      return await handler(event, {});
    } catch (err) {
      return error(err.message, err.codigo || 500, err.codigoError);
    }
  };
}

/**
 * Verifica si un usuario puede administrar un recurso propio.
 * @param {Object} usuario - Usuario autenticado.
 * @param {string} valorRecurso - Valor del recurso a comparar con usuarioId.
 * @returns {boolean}
 */
function puedeAdministrarPropio(usuario, valorRecurso) {
  if (!usuario) return false;
  if (ROLES_ADMIN.includes(usuario.rol)) return true;
  return usuario.usuarioId === valorRecurso;
}

module.exports = { autorizar, puedeAdministrarPropio, ROLES_ADMIN };