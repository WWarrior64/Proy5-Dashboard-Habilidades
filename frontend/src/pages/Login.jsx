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
  const [requiresNewPassword, setRequiresNewPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const { login, completePasswordChange } = useAuth()
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
      if (err.code === 'NEW_PASSWORD_REQUIRED') {
        setRequiresNewPassword(true)
        setPassword('')
      } else {
        setError(err.message || 'Error al iniciar sesión')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleNewPassword = async (event) => {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe contener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const result = await completePasswordChange(newPassword)
      setNewPassword('')
      setConfirmNewPassword('')
      navigate(ROUTE_BY_ROLE[result.user.rol] || '/dashboards/empleado', { replace: true })
    } catch (err) {
      setError(err.message || 'No se pudo guardar la nueva contraseña.')
    } finally {
      setLoading(false)
    }
  }

  const volverAlLogin = () => {
    setRequiresNewPassword(false)
    setNewPassword('')
    setConfirmNewPassword('')
    setError('')
  }

  if (requiresNewPassword) {
    return (
      <main className="login-page">
        <section className="login-card password-change-card" aria-labelledby="password-change-title">
          <div className="login-header password-change-header">
            <div className="login-logo" aria-hidden="true" />
            <h1 className="login-title" id="password-change-title">Establecer nueva contraseña</h1>
            <p className="password-change-description">
              Reemplaza la contraseña temporal que recibiste por correo electrónico.
            </p>
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}

          <form className="login-form password-change-form" onSubmit={handleNewPassword}>
            <div className="login-field">
              <label className="login-label" htmlFor="new-password">Nueva contraseña</label>
              <input
                className="login-input"
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="confirm-new-password">Confirmar contraseña</label>
              <input
                className="login-input"
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
                minLength={8}
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            <p className="password-change-hint">
              Utiliza una contraseña segura que cumpla las reglas de tu organización.
            </p>
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
          <button
            className="password-change-back"
            type="button"
            onClick={volverAlLogin}
            disabled={loading}
          >
            Volver a iniciar sesión
          </button>
        </section>
      </main>
    )
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
