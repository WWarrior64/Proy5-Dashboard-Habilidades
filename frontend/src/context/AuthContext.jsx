import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

/**
 * Punto de integración de autenticación.
 *
 * Proveedor-agnóstico: no asume que Cognito (ni cualquier otro proveedor)
 * ya esté conectado. Por defecto usa localStorage como mecanismo de sesión.
 * Para conectar Cognito u otro proveedor se puede pasar un `authAdapter`
 * con los métodos opcionales `getSession()` y `signOut()`.
 */
export function AuthProvider({ children, authAdapter }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const stored = localStorage.getItem('auth_user')
        if (stored) {
          try {
            setUser(JSON.parse(stored))
          } catch (e) {
            localStorage.removeItem('auth_user')
          }
        } else if (authAdapter?.getSession) {
          const session = await authAdapter.getSession()
          if (session) setUser(session)
        }
      } catch (e) {
        localStorage.removeItem('auth_user')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [authAdapter])

  const login = (userData) => {
    setUser(userData)
    localStorage.setItem('auth_user', JSON.stringify(userData))
  }

  const logout = async () => {
    setUser(null)
    localStorage.removeItem('auth_user')
    localStorage.removeItem('token')
    if (authAdapter?.signOut) {
      await authAdapter.signOut()
    }
  }

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    authAdapter,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
export function useAuth() {
  return useContext(AuthContext)
}