import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setMessage('Se ha enviado un enlace de recuperación a tu correo electrónico.')
      setLoading(false)
    } catch (err) {
      setMessage('Error al enviar el enlace de recuperación.')
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
            Ingresa tu correo electrónico para recibir un enlace de recuperación.
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
            />
          </div>

          <div className="forgot-link-container">
            <a
              href="#"
              className="forgot-link"
              onClick={(e) => { e.preventDefault(); navigate('/login') }}
            >
              Volver a iniciar sesión
            </a>
          </div>

          <button type="submit" className="forgot-btn" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
      </div>
    </div>
  )
}