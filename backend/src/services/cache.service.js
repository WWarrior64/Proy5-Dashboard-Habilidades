// Caché efímera disponible solo fuera de AWS Lambda.
// Las instancias Lambda no comparten memoria; allí se omite la caché para evitar
// servir datos obsoletos cuando otra función escribe en DynamoDB.
// Los GSIs de DynamoDB mantienen su propia consistencia eventual.
const cache = new Map();

// En Lambda no se utiliza una caché de proceso: cada instancia tiene su propio
// Map y las escrituras de otras Lambdas no pueden invalidarlo. Este modo evita
// servir entradas caducadas por escrituras externas, sin añadir infraestructura.
function cacheDisponible() {
  return !process.env.AWS_LAMBDA_FUNCTION_NAME;
}

/**
 * Entrada de caché con valor y marca de expiración.
 * @typedef {Object} CacheEntry
 * @property {any} valor - Valor almacenado
 * @property {number|null} expiraEn - Timestamp de expiración en ms (null = sin expiración)
 */

/**
 * Construye una clave de caché a partir de sus partes, de modo que cada consulta
 * disponga de una clave que diferencie sus filtros y parámetros (p. ej.
 * `proyectos:list:ACTIVO:lider123`).
 * @param {...string} partes - Segmentos de la clave
 * @returns {string} Clave compuesta unida con ':'
 */
function construirClave(...partes) {
  return partes.filter((p) => p !== undefined && p !== null && p !== '').join(':');
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
 * Elimina todas las claves cuya clave comienza con el prefijo dado.
 * Útil para invalidar listados tras una escritura (crear/modificar/cancelar).
 * @param {string} prefijo - Prefijo de las claves a eliminar
 * @returns {number} Cantidad de claves eliminadas
 */
function eliminarPorPrefijo(prefijo) {
  const claves = [];
  for (const clave of cache.keys()) {
    if (clave.startsWith(prefijo)) claves.push(clave);
  }
  for (const clave of claves) cache.delete(clave);
  return claves.length;
}

/**
 * Obtiene un valor de la caché. Si la entrada ha expirado, se elimina y se retorna undefined.
 * @param {string} clave - Clave de caché
 * @returns {any|undefined} Valor almacenado o undefined si no existe o expiró
 */
function obtener(clave) {
  if (!cacheDisponible()) return undefined;
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
  if (!cacheDisponible()) return;
  const expiraEn = ttlMs ? Date.now() + ttlMs : null;
  cache.set(clave, { valor, expiraEn });
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
  construirClave,
  eliminarPorPrefijo,
  obtenerClave,
  guardarClave,
};