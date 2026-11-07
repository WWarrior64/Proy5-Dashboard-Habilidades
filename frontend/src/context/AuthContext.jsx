import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api.js'
import {
  login as authLogin,
  completePasswordChange as authCompletePasswordChange,
  logout as authLogout,
  isAuthenticated as authIsAuthenticated,
} from '../services/auth.service.js'
import {
  startAutoRefresh, stopAutoRefresh, cleanup,
} from '../services/token-refresh.service.js'

const AuthContext = createContext(null)
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

function readDemoUser() {
  try { return JSON.parse(sessionStorage.getItem('demo_auth_user') || 'null') } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => DEMO_MODE ? readDemoUser() : null)
  const [loading, setLoading] = useState(!DEMO_MODE)

  useEffect(() => {
    if (DEMO_MODE) return
    let cancelled = false
    const restore = async () => {
      try {
        if (!authIsAuthenticated()) return
        const { data } = await api.get('/usuarios/yo')
        const profile = data?.datos || null
        if (!cancelled && profile?.usuarioId && profile.estado === 'ACTIVO') {
          setUser(profile)
          startAutoRefresh()
        } else if (!cancelled) {
          cleanup()
        }
      } catch (error) {
        // Un fallo temporal de red no invalida automáticamente las credenciales Cognito.
        if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 404) {
          cleanup()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    restore()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && authIsAuthenticated()) {
        // Axios valida/renueva antes de consultar. En una sesión ya autenticada,
        // comprueba que el perfil sigue activo sin perder el estado por un fallo de red.
        api.get('/usuarios/yo').then(({ data }) => {
          if (!cancelled && data?.datos?.estado === 'ACTIVO') setUser(data.datos)
        }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      stopAutoRefresh()
    }
  }, [])

  const login = async (email, password) => {
    if (DEMO_MODE) {
      const demoUser = typeof email === 'object' ? email : {
        usuarioId: 'demo_user', nombre: 'Usuario Demo', email,
        rol: 'ADMINISTRADOR', estado: 'ACTIVO',
      }
      sessionStorage.setItem('demo_auth_user', JSON.stringify(demoUser))
      setUser(demoUser)
      return { user: demoUser, tokens: null }
    }
    const result = await authLogin(email, password)
    setUser(result.user)
    startAutoRefresh(result.tokens.idToken)
    return result
  }

  const completePasswordChange = async (newPassword) => {
    const result = await authCompletePasswordChange(newPassword)
    setUser(result.user)
    startAutoRefresh(result.tokens.idToken)
    return result
  }

  const logout = async () => {
    stopAutoRefresh()
    if (DEMO_MODE) sessionStorage.removeItem('demo_auth_user')
    else {
      try { await authLogout() } finally { cleanup() }
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, completePasswordChange, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
export function useAuth() { return useContext(AuthContext) }
