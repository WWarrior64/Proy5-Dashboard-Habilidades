import { useCallback, useEffect, useState } from 'react'
import { useAutoDismiss } from '../../hooks/useAutoDismiss.js'
import './aviso-sin-perfil-colaborador.css'

export function esAvisoSinPerfilColaborador(mensaje) {
  return typeof mensaje === 'string' &&
    /(?:no tiene|no hay) un perfil de colaborador/i.test(mensaje)
}

export default function AvisoSinPerfilColaborador({ mensaje }) {
  const [visible, setVisible] = useState(true)
  const ocultar = useCallback(() => setVisible(false), [])

  useEffect(() => { setVisible(true) }, [mensaje])
  useAutoDismiss(visible ? mensaje : '', ocultar, 6000)

  if (!mensaje || !visible) return null
  return <div className="aviso-sin-perfil-colaborador" role="status" aria-live="polite">{mensaje}</div>
}
