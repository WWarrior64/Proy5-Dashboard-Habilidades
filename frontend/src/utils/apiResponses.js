/**
 * Utilidad compartida para interpretar respuestas de la API y paginación.
 * Evita que cada página tenga que comprobar por separado si la respuesta
 * contiene datos, items o un arreglo.
 */

/**
 * Extrae el arreglo de datos de una respuesta de API Lambda.
 * Soporta formatos: { datos: [...] }, { datos: { items: [...] } }, [...], { items: [...] }
 * @param {any} response - Respuesta de la API (puede ser objeto o arreglo)
 * @returns {Array} Arreglo de elementos o arreglo vacío si no hay datos
 */
export function extractItems(response) {
  if (!response) return []
  if (Array.isArray(response)) return response
  if (Array.isArray(response.datos)) return response.datos
  if (response.datos && Array.isArray(response.datos.items)) return response.datos.items
  if (Array.isArray(response.items)) return response.items
  return []
}

/**
 * Extrae el objeto de datos único de una respuesta de API Lambda.
 * Soporta formatos: { datos: {...} }, { ... }
 * @param {any} response - Respuesta de la API
 * @returns {any|null} Objeto de datos o null
 */
export function extractData(response) {
  if (!response) return null
  if (response.datos !== undefined) return response.datos
  return response
}

/**
 * Extrae información de paginación de una respuesta.
 * Soporta formatos: { datos: { items, lastKey }, lastKey, ... }
 * @param {any} response - Respuesta de la API
 * @returns {Object} { items, lastKey }
 */
export function extractPaginated(response) {
  if (!response) return { items: [], lastKey: null }
  if (Array.isArray(response)) return { items: response, lastKey: null }
  const datos = response.datos || response
  return {
    items: Array.isArray(datos.items) ? datos.items : [],
    lastKey: datos.lastKey || null,
  }
}

/**
 * Verifica si una respuesta de API indica éxito.
 * @param {any} response - Respuesta de la API
 * @returns {boolean}
 */
export function isSuccess(response) {
  if (!response) return false
  if (response.success !== undefined) return response.success === true
  return true
}

/**
 * Extrae el mensaje de error de una respuesta de API.
 * @param {any} response
 * @returns {string|null}
 */
export function extractErrorMessage(response) {
  if (!response) return null
  return response.error?.mensaje || response.error?.message || null
}