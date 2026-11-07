import {
  CognitoUserPool,
  CognitoUser,
  CognitoRefreshToken,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js'

const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-2_dDXoRPIRo'
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '6fvoc12jnef9n33o2rqoeddm05'
const REGION = import.meta.env.VITE_AWS_REGION || 'us-east-2'
const userPool = new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID })

function decodeJwtPayload(token) {
  try {
    const part = token?.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    const json = decodeURIComponent(Array.from(bytes, (char) =>
      `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function storeTokens(accessToken, idToken, refreshToken) {
  if (accessToken) localStorage.setItem('token', accessToken)
  if (idToken) localStorage.setItem('id_token', idToken)
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
}

function clearTokens() {
  localStorage.removeItem('token')
  localStorage.removeItem('id_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('auth_user')
}

const getAccessToken = () => localStorage.getItem('token')
const getIdToken = () => localStorage.getItem('id_token')
const getRefreshToken = () => localStorage.getItem('refresh_token')
const isAuthenticated = () => !!getIdToken() && !!getRefreshToken()

let pendingPasswordChange = null

function saveSession(session) {
  const tokens = {
    accessToken: session.getAccessToken().getJwtToken(),
    idToken: session.getIdToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
  }
  storeTokens(tokens.accessToken, tokens.idToken, tokens.refreshToken)
  return tokens
}

function completeNewPassword(newPassword) {
  if (!pendingPasswordChange) return Promise.reject(new Error('Vuelva a iniciar sesión para cambiar la contraseña.'))
  const { user, attributes } = pendingPasswordChange
  return new Promise((resolve, reject) => {
    user.completeNewPasswordChallenge(newPassword, attributes, {
      onSuccess: (session) => {
        pendingPasswordChange = null
        resolve(saveSession(session))
      },
      onFailure: (err) => {
        // Mostrar el motivo real de Cognito (p. ej. política de contraseña,
        // desafío vencido o contraseña temporal incorrecta) sin registrar claves.
        const message = err?.message || 'No se pudo establecer la contraseña nueva'
        const wrapped = new Error(message)
        wrapped.code = err?.code || err?.name || 'COGNITO_CHALLENGE_FAILED'
        if (['NotAuthorizedException', 'ExpiredCodeException', 'SessionExpiredException'].includes(wrapped.code)) {
          pendingPasswordChange = null
          wrapped.message = 'El desafío expiró o ya no es válido. Vuelva al inicio e ingrese de nuevo su contraseña temporal.'
        }
        reject(wrapped)
      },
      mfaRequired: () => reject(new Error('La cuenta requiere MFA; solicite ayuda al administrador')),
      totpRequired: () => reject(new Error('La cuenta requiere TOTP; solicite ayuda al administrador')),
    })
  })
}

function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const username = email.trim().toLowerCase()
    const user = new CognitoUser({ Username: username, Pool: userPool })
    const authentication = new AuthenticationDetails({ Username: username, Password: password })
    user.authenticateUser(authentication, {
      onSuccess: (session) => {
        pendingPasswordChange = null
        resolve(saveSession(session))
      },
      onFailure: (error) => {
        if (['NotAuthorizedException', 'UserNotFoundException'].includes(error?.code)) {
          reject(new Error('Correo electrónico o contraseña incorrectos'))
        } else if (error?.code === 'UserNotConfirmedException') {
          reject(new Error('La cuenta Cognito no está confirmada'))
        } else {
          reject(new Error(error?.message || 'No se pudo iniciar sesión en Cognito'))
        }
      },
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        // Cognito entrega TODOS los atributos actuales en userAttributes, pero
        // completeNewPasswordChallenge solo debe recibir los atributos que
        // Cognito pide completar en requiredAttributes. Reenviar email/sub u
        // otros atributos ya existentes puede causar InvalidParameterException.
        const attributes = {}
        const missingAttributes = []
        for (const rawName of requiredAttributes || []) {
          const name = rawName.replace(/^userAttributes\./, '')
          if (!/^[a-zA-Z][a-zA-Z0-9_:]*$/.test(name) ||
              ['sub', 'email_verified', 'phone_number_verified'].includes(name)) continue
          const value = userAttributes?.[name]
          if (typeof value === 'string' && value.trim()) attributes[name] = value
          else missingAttributes.push(name)
        }
        if (missingAttributes.length) {
          pendingPasswordChange = null
          reject(new Error(
            'Cognito requiere completar otros atributos del usuario (' +
            missingAttributes.join(', ') + '). Contacte al administrador.'
          ))
          return
        }
        pendingPasswordChange = { user, attributes }
        const challenge = new Error('Debe establecer una contraseña nueva para activar su cuenta.')
        challenge.code = 'NEW_PASSWORD_REQUIRED'
        reject(challenge)
      },
      mfaRequired: () => reject(new Error('Esta cuenta requiere MFA. El formulario actual aún no admite este desafío.')),
      totpRequired: () => reject(new Error('Esta cuenta requiere un código TOTP. El formulario actual aún no lo admite.')),
      mfaSetup: () => reject(new Error('Esta cuenta requiere configurar MFA antes de iniciar sesión.')),
      selectMFAType: () => reject(new Error('Esta cuenta requiere seleccionar un método MFA.')),
    })
  })
}

function refreshSession() {
  const oldRefreshToken = getRefreshToken()
  if (!oldRefreshToken) return Promise.reject(new Error('Sesión no renovable. Inicia sesión nuevamente.'))

  // Cognito Identity JS necesita un objeto CognitoRefreshToken y un usuario con nombre real.
  const payload = decodeJwtPayload(getIdToken())
  const username = userPool.getCurrentUser()?.getUsername()
    || payload?.['cognito:username'] || payload?.email
  if (!username) return Promise.reject(new Error('No se puede identificar la sesión Cognito para renovarla.'))
  const user = userPool.getCurrentUser() || new CognitoUser({ Username: username, Pool: userPool })
  const refreshToken = new CognitoRefreshToken({ RefreshToken: oldRefreshToken })

  return new Promise((resolve, reject) => {
    user.refreshSession(refreshToken, (error, session) => {
      if (error || !session) {
        reject(new Error('No se pudo renovar la sesión Cognito. Inicia sesión nuevamente.'))
        return
      }
      const tokens = {
        accessToken: session.getAccessToken().getJwtToken(),
        idToken: session.getIdToken().getJwtToken(),
        // Algunos flujos de renovación no devuelven un refresh token nuevo.
        refreshToken: session.getRefreshToken()?.getToken() || oldRefreshToken,
      }
      storeTokens(tokens.accessToken, tokens.idToken, tokens.refreshToken)
      resolve(tokens)
    })
  })
}

function signOut() {
  pendingPasswordChange = null
  // Cierra también la sesión en la caché que administra amazon-cognito-identity-js.
  userPool.getCurrentUser()?.signOut()
  clearTokens()
}

export {
  signIn, completeNewPassword, refreshSession, signOut, getAccessToken, getIdToken, getRefreshToken,
  isAuthenticated, clearTokens, storeTokens, decodeJwtPayload,
  USER_POOL_ID, CLIENT_ID, REGION,
}
