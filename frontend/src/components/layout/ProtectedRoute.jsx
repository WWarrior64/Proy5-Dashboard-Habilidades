import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { canAccessRoute } from '../../utils/permissions.js'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Verificar permiso de acceso a la ruta solicitada
  if (!canAccessRoute(user.rol, location.pathname)) {
    return <Navigate to="/" replace />
  }

  return children
}