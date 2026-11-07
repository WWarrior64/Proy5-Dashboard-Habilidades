const { CODIGOS } = require('../utils/errors');

const ROLES_JERARQUIA = {
  EMPLEADO: 1,
  RRHH: 2,
  LIDER_PROYECTO: 3,
  ADMINISTRADOR: 4,
};

const ROLES_ADMIN = ['ADMINISTRADOR', 'RRHH'];

/**
 * Verifica si un rol tiene permiso para realizar una operación administrativa.
 * @param {string} rol - Rol del usuario.
 * @returns {boolean}
 */
function esAdministrador(rol) {
  return ROLES_ADMIN.includes(rol);
}

/**
 * Verifica si un rol puede gestionar a otro rol.
 * @param {string} rolGestor - Rol del usuario que gestiona.
 * @param {string} rolGestionado - Rol del usuario objetivo.
 * @returns {boolean}
 */
function puedeGestionarRol(rolGestor, rolGestionado) {
  if (rolGestor === 'ADMINISTRADOR') return true;
  if (rolGestor === 'RRHH') {
    return rolGestionado !== 'ADMINISTRADOR';
  }
  return false;
}

/**
 * Verifica si un usuario tiene el rol requerido.
 * @param {Object} usuario - Usuario autenticado.
 * @param {string|Array} rolesPermitidos - Roles permitidos.
 * @returns {boolean}
 */
function tieneRol(usuario, rolesPermitidos) {
  if (!usuario) return false;
  const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
  return roles.includes(usuario.rol);
}

/**
 * Compara niveles jerárquicos de roles.
 * @param {string} rolA
 * @param {string} rolB
 * @returns {number} positivo si rolA > rolB, cero si son iguales, negativo si rolA < rolB.
 */
function compararJerarquia(rolA, rolB) {
  return (ROLES_JERARQUIA[rolA] || 0) - (ROLES_JERARQUIA[rolB] || 0);
}

module.exports = {
  esAdministrador,
  puedeGestionarRol,
  tieneRol,
  compararJerarquia,
  ROLES_ADMIN,
  ROLES_JERARQUIA,
};