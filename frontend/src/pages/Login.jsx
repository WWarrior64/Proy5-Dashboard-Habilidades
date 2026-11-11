import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

const ROUTE_BY_ROLE = {
  ADMINISTRADOR: '/dashboards/administrador',
  RRHH: '/dashboards/rrhh',
  LIDER_PROYECTO: '/dashboards/lider',
  EMPLEADO: '/dashboards/empleado',
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (import.meta.env.VITE_DEMO_MODE === 'true') {
        const demoUser = {
          usuarioId: 'demo_user',
          nombre: 'Usuario Demo',
          email,
          rol: 'ADMINISTRADOR',
          estado: 'ACTIVO',
        }
        await login(demoUser)
        navigate(ROUTE_BY_ROLE[demoUser.rol], { replace: true })
        return
      }
      const result = await login(email, password)
      navigate(ROUTE_BY_ROLE[result.user.rol] || '/dashboards/empleado', { replace: true })
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo" />
          <h1 className="login-title">Internal Marketplace</h1>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
              <label className="login-label" htmlFor="email">Correo Electrónico</label>
              <input
                id="email"
                type="email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          <div className="login-forgot-password">
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/forgot-password') }}>
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Procesando...' : 'Iniciar sesión'}
            </button>
        </form>

        {import.meta.env.VITE_DEMO_MODE === 'true' && (
          <div className="demo-mode">
            <p className="demo-label">Modo demostración</p>
            <p className="demo-text">Cualquier credencial funciona en modo demo.</p>
          </div>
        )}
      </div>
    </div>
  )
}
