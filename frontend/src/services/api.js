import axios from 'axios'
import { resolverApiUrl } from '../utils/apiConfig.js'
import { getValidIdToken, cleanup } from './token-refresh.service.js'

const API_URL = resolverApiUrl({ direccion: import.meta.env.VITE_API_URL, desarrollo: import.meta.env.DEV })
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  if (!API_URL) throw new Error('Falta VITE_API_URL en la configuración de este despliegue.')
  // El autorizador COGNITO_USER_POOLS de esta API REST no declara OAuth scopes:
  // API Gateway espera el ID Token, no el Access Token.
  const token = await getValidIdToken()
  config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      cleanup()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export { api }
export default api
