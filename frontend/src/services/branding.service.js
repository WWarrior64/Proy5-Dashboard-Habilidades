import { resolverApiUrl } from '../utils/apiConfig.js'

export const NOMBRE_PREDETERMINADO = 'Internal Marketplace'
let solicitud = null
const MARCA_REINTENTO_MS = 10 * 60_000
const claveError = 'internal-marketplace-branding-api-unavailable'

function rutaTemporalmenteNoDisponible(api) {
  try {
    const registro = JSON.parse(window.sessionStorage.getItem(claveError) || 'null')
    return registro?.api === api && registro.hasta > Date.now()
  } catch { return false }
}

export function obtenerNombreOrganizacion() {
  if (!solicitud) {
    const api = resolverApiUrl({
      direccion: import.meta.env.VITE_API_URL,
      desarrollo: import.meta.env.DEV,
    })
    if (!api || import.meta.env.MODE === 'test' || rutaTemporalmenteNoDisponible(api)) {
      return Promise.resolve(NOMBRE_PREDETERMINADO)
    }
    solicitud = fetch(api.replace(/\/$/, '') + '/branding', {
      method: 'GET', headers: { Accept: 'application/json' },
    }).then(async respuesta => {
      if (!respuesta.ok) throw new Error('Nombre público no disponible')
      return respuesta.json()
    }).then(datos => {
      const valor = datos?.datos?.nombreOrganizacion
      return typeof valor === 'string' && valor.trim()
        ? valor.trim() : NOMBRE_PREDETERMINADO
    }).catch(() => {
      try {
        window.sessionStorage.setItem(claveError, JSON.stringify({
          api, hasta: Date.now() + MARCA_REINTENTO_MS,
        }))
      } catch { /* La marca predeterminada se mantiene aunque no haya almacenamiento. */ }
      return NOMBRE_PREDETERMINADO
    })
  }
  return solicitud
}

export function invalidarNombreOrganizacion() {
  solicitud = null
  try { window.sessionStorage.removeItem(claveError) } catch { /* Sin almacenamiento. */ }
  window.dispatchEvent(new Event('internal-marketplace-brand-updated'))
}
