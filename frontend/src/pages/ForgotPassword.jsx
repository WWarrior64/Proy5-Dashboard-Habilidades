import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { solicitarRecuperacion, confirmarRecuperacion } from '../services/cognito.service.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fase, setFase] = useState('solicitar')
  const [codigo, setCodigo] = useState('')
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      if (fase === 'solicitar') {
        await solicitarRecuperacion(email)
        setFase('confirmar')
        setMessage('Si la cuenta permite recuperación, Cognito enviará un código al correo registrado.')
      } else {
        await confirmarRecuperacion(email, codigo, nuevaContrasena)
        setFase('terminado')
        setMessage('Contraseña actualizada. Ya puedes iniciar sesión.')
      }
    } catch (err) {
      setError(err?.message || 'No se pudo completar la recuperación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="forgot-page">
      <div className="forgot-card">
        <div className="forgot-header">
          <div className="forgot-logo" />
          <h1 className="forgot-title">Recuperar contraseña</h1>
          <p className="forgot-description">
            {fase === 'solicitar'
              ? 'Ingresa tu correo electrónico para recibir un código de recuperación.'
              : fase === 'confirmar'
                ? 'Introduce el código recibido y establece una contraseña nueva.'
                : 'Tu contraseña ha sido actualizada.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="forgot-form">
          <div className="forgot-field">
            <label className="forgot-label" htmlFor="email">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              className="forgot-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              required
              disabled={fase !== 'solicitar'}
            />
          </div>

          {fase === 'confirmar' && (
            <>
              <div className="forgot-field">
                <label className="forgot-label" htmlFor="codigo">Código de verificación</label>
                <input id="codigo" className="forgot-input" inputMode="numeric" autoComplete="one-time-code"
                  value={codigo} onChange={e => setCodigo(e.target.value)} required />
              </div>
              <div className="forgot-field">
                <label className="forgot-label" htmlFor="nueva-contrasena">Nueva contraseña</label>
                <input id="nueva-contrasena" className="forgot-input" type="password"
                  autoComplete="new-password" minLength={8} value={nuevaContrasena}
                  onChange={e => setNuevaContrasena(e.target.value)} required />
              </div>
            </>
          )}
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}

          <div className="forgot-link-container">
            <a
              href="#"
              className="forgot-link"
              onClick={(e) => { e.preventDefault(); navigate('/login') }}
            >
              Volver a iniciar sesión
            </a>
          </div>

          {fase !== 'terminado' && <button type="submit" className="forgot-btn" disabled={loading}>
            {loading ? 'Procesando...' : fase === 'solicitar' ? 'Enviar código' : 'Cambiar contraseña'}
          </button>}
        </form>
      </div>
    </div>
  )
}