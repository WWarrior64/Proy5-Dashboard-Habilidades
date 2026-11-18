// Caché efímera en memoria, por instancia de ejecución (Node.js / AWS Lambda).
//
// ARQUITECTURA (compatible con AWS Lambda):
//   * Cada instancia de Lambda ejecuta su propio proceso y su propio Map en
//     memoria. Los entornos de ejecución "cálidos" (warm starts) reutilizan esta
//     caché y aceleran las solicitudes repetidas DENTRO de esa misma instancia.
//   * NO es una caché distribuida: las escrituras realizadas por otra instancia
//     Lambda NO invalidan esta caché. Por ese motivo se usan TTL cortos e
//     se invalida localmente tras cada escritura de la misma instancia.
//   * Los "cold starts" comienzan con la caché vacía: nunca sirven datos
//     obsoletos de invocaciones previas, ni comparten estado entre instancias.
//   * Para proteger la memoria de Lambda existe una capacidad máxima de
//     entradas con expulsión LRU (al superar la capacidad se elimina la entrada
//     menos recientemente usada).
//
// Variables de entorno opcionales:
//   CACHE_TTL_SECONDS   TTL por defecto en segundos cuando no se indica ttlMs
//                       (por defecto: 300 segundos / 5 minutos).
//   CACHE_MAX_ENTRIES   Capacidad máxima de entradas en memoria (por defecto: 500).
//
// Contrato de rendimiento: la caché es una capa transparente. Si falla, se omite
// y se lee directamente de DynamoDB; nunca bloquea una petición por caché.
const { cacheTtlSeconds } = require('../config/environment.js');

const TTL_POR_DEFECTO_MS =
  Number.isFinite(cacheTtlSeconds) && cacheTtlSeconds > 0
    ? cacheTtlSeconds * 1000
    : 300_000;

const CAPACIDAD_MAXIMA = (function () {
  const valor = Number(process.env.CACHE_MAX_ENTRIES);
  return Number.isFinite(valor) && valor > 0 ? valor : 500;
})();

const entradas = new Map();
const contadores = {
  hits: 0,
  misses: 0,
  escrituras: 0,
  evictadas: 0,
  expiracionesLimpieza: 0,
};

function ahora() {
  return Date.now();
}

function entradaExpirada(entrada) {
  return entrada.expiraEn !== null && ahora() > entrada.expiraEn;
}

function evictarMasAntigua() {
  if (entradas.size === 0) {return;}
  const claveMasAntigua = entradas.keys().next().value;
  entradas.delete(claveMasAntigua);
  contadores.evictadas += 1;
}

/**
 * Entrada de caché con valor, marca de expiración y metadatos de uso.
 * @typedef {Object} CacheEntry
 * @property {any} valor - Valor almacenado
 * @property {number|null} expiraEn - Timestamp de expiración en ms (null = sin expiración)
 * @property {number} creadoEn - Timestamp de creación en ms
 */

/**
 * Construye una clave de caché a partir de sus partes, de modo que cada consulta
 * disponga de una clave que diferencie sus filtros y parámetros (p. ej.
 * `cargos:list:ACTIVO:25:null`).
 * @param {...string} partes - Segmentos de la clave
 * @returns {string} Clave compuesta unida con ':'
 */
function construirClave(...partes) {
  return partes.filter((p) => p !== undefined && p !== null && p !== '').join(':');
}

/**
 * Indica si la caché está habilitada. La estrategia por instancia está siempre
 * activa; en AWS Lambda funciona por entorno de ejecución cálido y se reinicia
 * en cada cold start.
 * @returns {boolean} true
 */
function estaHabilitada() {
  return true;
}

/**
 * Obtiene un valor de la caché. Si la entrada ha expirado, se elimina y se
 * retorna undefined. Un acierto actualiza el orden de uso (LRU).
 * @param {string} clave - Clave de caché
 * @returns {any|undefined} Valor almacenado o undefined si no existe o expiró
 */
function obtener(clave) {
  const entrada = entradas.get(clave);
  if (!entrada) {
    contadores.misses += 1;
    return undefined;
  }

  if (entradaExpirada(entrada)) {
    entradas.delete(clave);
    contadores.misses += 1;
    contadores.expiracionesLimpieza += 1;
    return undefined;
  }

  // LRU: la entrada accedida pasa a ser la más reciente.
  const valor = entrada.valor;
  entradas.delete(clave);
  entradas.set(clave, entrada);

  contadores.hits += 1;
  return valor;
}

/**
 * Guarda un valor en la caché con TTL opcional.
 * @param {string} clave - Clave de caché
 * @param {any} valor - Valor a almacenar
 * @param {number} [ttlMs] - Tiempo de vida en milisegundos. Si se omite, se usa el TTL por defecto.
 */
function guardar(clave, valor, ttlMs) {
  const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : TTL_POR_DEFECTO_MS;
  const expiraEn = ttl > 0 ? ahora() + ttl : null;

  if (!entradas.has(clave)) {
    while (entradas.size >= CAPACIDAD_MAXIMA && CAPACIDAD_MAXIMA > 0) {
      evictarMasAntigua();
    }
  }

  // Sobrescribir también actualiza su antigüedad para que LRU sea correcto.
  if (entradas.has(clave)) {entradas.delete(clave);}
  entradas.set(clave, { valor, expiraEn, creadoEn: ahora() });
  contadores.escrituras += 1;
}

/**
 * Elimina una clave específica de la caché.
 * @param {string} clave - Clave a eliminar
 * @returns {boolean} true si se eliminó, false si no existía
 */
function eliminar(clave) {
  return entradas.delete(clave);
}

/**
 * Elimina todas las claves cuya clave comienza con el prefijo dado.
 * Útil para invalidar listados tras una escritura (crear/modificar/baja).
 * @param {string} prefijo - Prefijo de las claves a eliminar
 * @returns {number} Cantidad de claves eliminadas
 */
function eliminarPorPrefijo(prefijo) {
  const claves = [];
  for (const clave of entradas.keys()) {
    if (clave.startsWith(prefijo)) {claves.push(clave);}
  }
  for (const clave of claves) {entradas.delete(clave);}
  return claves.length;
}

/**
 * Limpia todas las entradas de la caché y reinicia los contadores de estadísticas.
 */
function limpiar() {
  entradas.clear();
  contadores.hits = 0;
  contadores.misses = 0;
  contadores.escrituras = 0;
  contadores.evictadas = 0;
  contadores.expiracionesLimpieza = 0;
}

/**
 * Elimina todas las entradas expiradas de la caché.
 * @returns {number} Cantidad de entradas eliminadas
 */
function limpiarExpirados() {
  let eliminados = 0;

  for (const [clave, entrada] of entradas.entries()) {
    if (entradaExpirada(entrada)) {
      entradas.delete(clave);
      eliminados += 1;
    }
  }

  contadores.expiracionesLimpieza += eliminados;
  return eliminados;
}

/**
 * Retorna estadísticas de la caché.
 * @returns {Object} { hits, misses, solicitudes, tasaHit, entradasActivas,
 *   entradasExpiradas, capacidadMaxima, entradasTotales, entradasEvictadas, escrituras }
 */
function obtenerEstadisticas() {
  let expiradas = 0;

  for (const entrada of entradas.values()) {
    if (entradaExpirada(entrada)) {expiradas += 1;}
  }

  const solicitudes = contadores.hits + contadores.misses;

  return {
    hits: contadores.hits,
    misses: contadores.misses,
    solicitudes,
    tasaHit: solicitudes === 0 ? 0 : contadores.hits / solicitudes,
    entradasActivas: entradas.size - expiradas,
    entradasExpiradas: expiradas,
    entradasTotales: entradas.size,
    capacidadMaxima: CAPACIDAD_MAXIMA,
    entradasEvictadas: contadores.evictadas,
    expiracionesLimpieza: contadores.expiracionesLimpieza,
    escrituras: contadores.escrituras,
  };
}

// Aliases de retrocompatibilidad con la versión anterior del stub
const obtenerClave = obtener;
const guardarClave = guardar;

module.exports = {
  estaHabilitada,
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