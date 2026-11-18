// Preserva la conexión conocida del desarrollo local sin incorporarla a builds publicados.
export const API_DESARROLLO = 'https://hcy3yy7u7c.execute-api.us-east-2.amazonaws.com/prod/api/v1'

export function resolverApiUrl({ direccion = '', desarrollo = false } = {}) {
  return String(direccion || '').trim() || (desarrollo ? API_DESARROLLO : '')
}
