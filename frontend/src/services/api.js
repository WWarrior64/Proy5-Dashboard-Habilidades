import axios from 'axios'
import { getValidIdToken, cleanup } from './token-refresh.service.js'

const API_URL = import.meta.env.VITE_API_URL || 'https://hcy3yy7u7c.execute-api.us-east-2.amazonaws.com/prod/api/v1'
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
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
