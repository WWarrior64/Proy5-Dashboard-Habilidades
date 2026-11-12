import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Power } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'

export default function EmpleadoLogoutButton() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [cerrando, setCerrando] = useState(false)

  const cerrarSesion = async () => {
    if (cerrando) return
    setCerrando(true)

    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setCerrando(false)
      window.alert('No se pudo cerrar sesión. Inténtalo de nuevo.')
    }
  }

  return (
    <button
      type="button"
      className="emp-sidebar-logout"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      onClick={cerrarSesion}
      disabled={cerrando}
    >
      <Power size={19} strokeWidth={2.2} aria-hidden="true" />
    </button>
  )
}
