/** Traduce los errores de API Gateway/Lambda en mensajes visibles, sin registrar tokens. */
export function getApiErrorMessage(error, fallback = 'No se pudo completar la operación') {
  const status = error?.response?.status
  const body = error?.response?.data
  const detail = body?.error?.mensaje || body?.message || body?.mensaje
  if (typeof detail === 'string' && detail.trim()) return detail
  if (status === 401) return 'La solicitud fue rechazada por autenticación (401). Comprueba la sesión Cognito.'
  if (status === 403) return 'Acceso rechazado (403) por API Gateway o el backend. Comprueba permisos y método publicado.'
  if (status === 404) return 'No se encontró el recurso solicitado (404).'
  if (status === 400) return 'La API rechazó los datos o filtros de esta solicitud (400).'
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'No se pudo leer la respuesta de API Gateway. Revisa red, token y cabeceras CORS.'
  }
  return error?.message || fallback
}
