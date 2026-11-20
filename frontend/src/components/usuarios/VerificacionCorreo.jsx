import { useEffect, useState } from 'react'
import {
  obtenerEstadoVerificacionCorreo,
  solicitarVerificacionCorreo,
  confirmarVerificacionCorreo,
} from '../../services/cognito.service.js'

export default function VerificacionCorreo({ email }) {
  const [estado, setEstado] = useState('consultando')
  const [correoCognito, setCorreoCognito] = useState('')
  const [codigo, setCodigo] = useState('')
  const [codigoEnviado, setCodigoEnviado] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let cancelado = false
    obtenerEstadoVerificacionCorreo()
      .then(resultado => {
        if (cancelado) return
        setCorreoCognito(resultado.email)
        setEstado(resultado.verificado ? 'verificado' : 'pendiente')
      })
      .catch(error_ => {
        if (cancelado) return
        setError(error_.message)
        setEstado('error')
      })
    return () => { cancelado = true }
  }, [email])

  const enviarCodigo = async () => {
    setProcesando(true)
    setError('')
    setMensaje('')
    try {
      await solicitarVerificacionCorreo()
      setCodigoEnviado(true)
      setMensaje('Se envió un código de verificación al correo registrado en Cognito.')
    } catch (error_) {
      setError(error_.message)
    } finally {
      setProcesando(false)
    }
  }

  const verificar = async evento => {
    evento.preventDefault()
    if (!codigo.trim()) return
    setProcesando(true)
    setError('')
    try {
      await confirmarVerificacionCorreo(codigo)
      setEstado('verificado')
      setCodigoEnviado(false)
      setCodigo('')
      setMensaje('Correo electrónico verificado. Ya puedes recuperar tu contraseña mediante Cognito.')
    } catch (error_) {
      setError(error_.message)
    } finally {
      setProcesando(false)
    }
  }

  if (estado === 'consultando') return null

  return (
    <section className="perfil-verificacion" aria-label="Verificación del correo de la cuenta">
      <h2>Verificación de correo electrónico</h2>
      {estado === 'verificado' ? (
        <p>Correo verificado en Amazon Cognito. La recuperación de contraseña está habilitada.</p>
      ) : (
        <>
          <p>
            {estado === 'error'
              ? 'No se pudo consultar la verificación del correo.'
              : 'El correo aún no está verificado en Cognito. Para habilitar la recuperación de contraseña, confirma el código que recibirás en tu dirección registrada.'}
          </p>
          {estado === 'pendiente' && (
            <>
              <p>Correo registrado: <strong>{correoCognito || email || 'No disponible'}</strong></p>
              {!codigoEnviado ? (
                <button type="button" onClick={enviarCodigo} disabled={procesando || !correoCognito}>
                  {procesando ? 'Enviando código...' : 'Enviar código de verificación'}
                </button>
              ) : (
                <form onSubmit={verificar} className="perfil-verificacion-form">
                  <label htmlFor="verificacion-codigo">Código de verificación</label>
                  <input id="verificacion-codigo" value={codigo} onChange={evento => setCodigo(evento.target.value)}
                    autoComplete="one-time-code" inputMode="numeric" required disabled={procesando} />
                  <button type="submit" disabled={procesando || !codigo.trim()}>
                    {procesando ? 'Verificando...' : 'Confirmar correo'}
                  </button>
                  <button type="button" className="perfil-verificacion-reenviar"
                    onClick={enviarCodigo} disabled={procesando}>Reenviar código</button>
                </form>
              )}
            </>
          )}
        </>
      )}
      {mensaje && <output>{mensaje}</output>}
      {error && <p className="perfil-verificacion-error" role="alert">{error}</p>}
    </section>
  )
}
