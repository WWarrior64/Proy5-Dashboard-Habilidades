import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import Button from '../components/common/Button.jsx'

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
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChallenge, setPasswordChallenge] = useState(false)
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
      let result
      if (passwordChallenge) {
        if (newPassword.length < 8) throw new Error('La contraseña nueva debe tener al menos 8 caracteres.')
        if (newPassword !== confirmPassword) throw new Error('Las contraseñas nuevas no coinciden.')
        result = await completePasswordChange(newPassword)
      } else {
        result = await login(email, password)
      }
      navigate(ROUTE_BY_ROLE[result.user.rol] || '/dashboards/empleado', { replace: true })
    } catch (err) {
      if (err.code === 'NEW_PASSWORD_REQUIRED') setPasswordChallenge(true)
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d8e4ef' }}>
      <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '48px', height: '48px', background: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <span style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>IM</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#172554', margin: 0 }}>Internal Marketplace</h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0' }}>
            {passwordChallenge ? 'Cambie la contraseña temporal para activar su cuenta' : 'Inicie sesión para continuar'}
          </p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!passwordChallenge && <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#172554', marginBottom: '0.25rem' }}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              style={{ width: '100%', padding: '0.6rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.95rem' }}
              required
            />
          </div>}
          {!passwordChallenge && <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#172554', marginBottom: '0.25rem' }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '0.6rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.95rem' }}
              required
            />
          </div>}
          {passwordChallenge && <>
            <div>
              <label className="label">Contraseña nueva</label>
              <input className="input" type="password" autoComplete="new-password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
            </div>
            <div>
              <label className="label">Confirmar contraseña nueva</label>
              <input className="input" type="password" autoComplete="new-password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
            </div>
          </>}
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Procesando...' : passwordChallenge ? 'Establecer contraseña' : 'Iniciar sesión'}
          </Button>
          {passwordChallenge && <button type="button" onClick={() => { setPasswordChallenge(false); setNewPassword(''); setConfirmPassword(''); setError('') }}
            style={{ color: '#2563eb', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            Volver a iniciar sesión
          </button>}
        </form>

        {import.meta.env.VITE_DEMO_MODE === 'true' && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Modo demostración</p>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>Cualquier credencial funciona en modo demo.</p>
          </div>
        )}
      </div>
    </div>
  )
}
