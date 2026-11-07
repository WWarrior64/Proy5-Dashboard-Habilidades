import {
  refreshSession as cognitoRefreshSession,
  getAccessToken, getIdToken, getRefreshToken, decodeJwtPayload, clearTokens,
} from './cognito.service.js'

const REFRESH_BUFFER_MS = 5 * 60 * 1000
let timer = null
let refreshPromise = null

function expirationMs(token) {
  const exp = decodeJwtPayload(token)?.exp
  return Number.isFinite(exp) ? exp * 1000 : 0
}

function getTimeUntilExpiry() {
  return expirationMs(getIdToken()) - Date.now()
}

function shouldRefresh() {
  return getTimeUntilExpiry() <= REFRESH_BUFFER_MS
}

async function performRefresh() {
  if (!refreshPromise) {
    refreshPromise = cognitoRefreshSession()
      .then((tokens) => {
        scheduleRefresh()
        return tokens
      })
      .catch((error) => {
        cleanup()
        throw error
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

function stopAutoRefresh() {
  if (timer !== null) clearTimeout(timer)
  timer = null
}

function scheduleRefresh() {
  stopAutoRefresh()
  if (!getRefreshToken() || !getIdToken()) return
  const wait = Math.max(0, getTimeUntilExpiry() - REFRESH_BUFFER_MS)
  timer = setTimeout(() => {
    performRefresh().catch(() => {
      // La próxima interacción solicitará un nuevo inicio de sesión.
    })
  }, wait)
}

function startAutoRefresh(idToken = getIdToken()) {
  if (idToken && getRefreshToken()) scheduleRefresh()
}

async function getValidIdToken() {
  const token = getIdToken()
  if (!token || !getRefreshToken()) throw new Error('No existe una sesión Cognito válida')
  if (shouldRefresh()) await performRefresh()
  const updated = getIdToken()
  if (!updated || expirationMs(updated) <= Date.now()) {
    throw new Error('La sesión Cognito expiró. Inicia sesión nuevamente.')
  }
  return updated
}

async function getValidAccessToken() {
  if (!getAccessToken() || !getRefreshToken()) throw new Error('No existe una sesión Cognito válida')
  if (shouldRefresh() || expirationMs(getAccessToken()) <= Date.now() + REFRESH_BUFFER_MS) {
    await performRefresh()
  }
  return getAccessToken()
}

function cleanup() {
  stopAutoRefresh()
  clearTokens()
}

export {
  startAutoRefresh, stopAutoRefresh, getValidIdToken, getValidAccessToken,
  cleanup, shouldRefresh, getTimeUntilExpiry,
}
