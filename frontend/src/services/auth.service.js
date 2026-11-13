import api from './api.js'
import {
  signIn as cognitoSignIn,
  completeNewPassword as cognitoCompleteNewPassword,
  refreshSession as cognitoRefreshSession,
  signOut as cognitoSignOut,
  getIdToken,
  isAuthenticated as cognitoIsAuthenticated,
} from './cognito.service.js'

async function readProfile(tokens) {
  try {
    const { data } = await api.get('/usuarios/yo')
    const usuario = data?.datos || (data?.usuarioId ? data : null)
    if (!usuario?.usuarioId) throw new Error('La API no devolvió un perfil de usuario válido.')
    if (usuario.estado !== 'ACTIVO') throw new Error('Tu perfil de usuario está inactivo.')
    // Solo un nuevo inicio de sesión (incluido el cambio obligatorio de contraseña)
    // registra el acceso. La restauración y el refresco de tokens usan GET y no lo alteran.
    let perfilActualizado = usuario
    try {
      const respuesta = await api.post('/usuarios/yo/acceso')
      if (respuesta.data?.datos?.usuarioId === usuario.usuarioId) {
        perfilActualizado = respuesta.data.datos
      }
    } catch (registroError) {
      if ([401, 403].includes(registroError.response?.status)) throw registroError
      // Permite iniciar sesión durante una actualización gradual de API y frontend.
      console.warn('No se pudo registrar el último acceso:', registroError.message)
    }
    return { user: perfilActualizado, tokens }
  } catch (error) {
    await cognitoSignOut()
    if (error.response?.status === 404) throw new Error('La cuenta Cognito existe, pero todavía no tiene perfil en DynamoDB.')
    if (error.response?.status === 403) throw new Error('El perfil no tiene autorización para entrar o está inactivo.')
    if (error.response?.status === 401) throw new Error('API Gateway rechazó el token Cognito.')
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('No se pudo conectar con API Gateway. Compruebe la conexión y CORS.')
    }
    throw error
  }
}

async function login(email, password) {
  const tokens = await cognitoSignIn(email, password)
  return readProfile(tokens)
}

async function completePasswordChange(newPassword) {
  const tokens = await cognitoCompleteNewPassword(newPassword)
  return readProfile(tokens)
}

const refresh = () => cognitoRefreshSession()
const logout = () => cognitoSignOut()
const isAuthenticated = () => cognitoIsAuthenticated()
const getToken = () => getIdToken()

export { login, completePasswordChange, refresh, logout, isAuthenticated, getToken }
