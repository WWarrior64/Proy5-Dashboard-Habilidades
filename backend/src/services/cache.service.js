const cache = new Map();

/**
 * Entrada de caché con valor y marca de expiración.
 * @typedef {Object} CacheEntry
 * @property {any} valor - Valor almacenado
 * @property {number|null} expiraEn - Timestamp de expiración en ms (null = sin expiración)
 */

/**
 * Obtiene un valor de la caché. Si la entrada ha expirado, se elimina y se retorna undefined.
 * @param {string} clave - Clave de caché
 * @returns {any|undefined} Valor almacenado o undefined si no existe o expiró
 */
function obtener(clave) {
  const entrada = cache.get(clave);
  if (!entrada) return undefined;

  if (entrada.expiraEn !== null && Date.now() > entrada.expiraEn) {
    cache.delete(clave);
    return undefined;
  }

  return entrada.valor;
}

/**
 * Guarda un valor en la caché con TTL opcional.
 * @param {string} clave - Clave de caché
 * @param {any} valor - Valor a almacenar
 * @param {number} [ttlMs] - Tiempo de vida en milisegundos. Si se omite, la entrada no expira.
 */
function guardar(clave, valor, ttlMs) {
  const expiraEn = ttlMs ? Date.now() + ttlMs : null;
  cache.set(clave, { valor, expiraEn });
}

/**
 * Elimina una clave específica de la caché.
 * @param {string} clave - Clave a eliminar
 * @returns {boolean} true si se eliminó, false si no existía
 */
function eliminar(clave) {
  return cache.delete(clave);
}

/**
 * Limpia todas las entradas de la caché.
 */
function limpiar() {
  cache.clear();
}

/**
 * Elimina todas las entradas expiradas de la caché.
 * @returns {number} Cantidad de entradas eliminadas
 */
function limpiarExpirados() {
  const ahora = Date.now();
  let eliminados = 0;

  for (const [clave, entrada] of cache.entries()) {
    if (entrada.expiraEn !== null && ahora > entrada.expiraEn) {
      cache.delete(clave);
      eliminados++;
    }
  }

  return eliminados;
}

/**
 * Retorna estadísticas de la caché.
 * @returns {Object} { tamaño, expirados, activos }
 */
function obtenerEstadisticas() {
  const ahora = Date.now();
  let expirados = 0;

  for (const entrada of cache.values()) {
    if (entrada.expiraEn !== null && ahora > entrada.expiraEn) {
      expirados++;
    }
  }

  return {
    tamaño: cache.size,
    expirados,
    activos: cache.size - expirados,
  };
}

// Aliases de retrocompatibilidad con la versión anterior del stub
const obtenerClave = obtener;
const guardarClave = guardar;

module.exports = {
  obtener,
  guardar,
  eliminar,
  limpiar,
  limpiarExpirados,
  obtenerEstadisticas,
  obtenerClave,
  guardarClave,
};