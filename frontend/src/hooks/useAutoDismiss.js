import { useEffect } from 'react'

/**
 * Oculta los avisos temporales después de unos segundos.
 * El temporizador se cancela si cambia el mensaje o se desmonta la vista.
 * No usar para errores de formularios, diálogos de confirmación ni estados de carga.
 */
export function useAutoDismiss(message, clearMessage, delayMs = 7000) {
  useEffect(() => {
    if (!message) return undefined

    const timer = window.setTimeout(() => clearMessage(''), delayMs)
    return () => window.clearTimeout(timer)
  }, [message, clearMessage, delayMs])
}
