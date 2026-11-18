import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoDismiss } from '../hooks/useAutoDismiss.js'

describe('Cierre automático de avisos temporales', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('retira el aviso siete segundos después de mostrarse', () => {
    const limpiar = vi.fn()
    renderHook(() => useAutoDismiss('Configuración guardada', limpiar))
    act(() => vi.advanceTimersByTime(6999))
    expect(limpiar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(limpiar).toHaveBeenCalledTimes(1)
    expect(limpiar).toHaveBeenCalledWith('')
  })

  it('reinicia la cuenta regresiva cuando el aviso cambia', () => {
    const limpiar = vi.fn()
    const { rerender } = renderHook(({ mensaje }) => useAutoDismiss(mensaje, limpiar), {
      initialProps: { mensaje: 'Aviso inicial' },
    })
    act(() => vi.advanceTimersByTime(4000))
    rerender({ mensaje: 'Aviso actualizado' })
    act(() => vi.advanceTimersByTime(4000))
    expect(limpiar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(3000))
    expect(limpiar).toHaveBeenCalledTimes(1)
  })

  it('no programa cierres si no hay mensaje', () => {
    const limpiar = vi.fn()
    renderHook(() => useAutoDismiss('', limpiar))
    act(() => vi.advanceTimersByTime(12000))
    expect(limpiar).not.toHaveBeenCalled()
  })

  it('cancela el cierre al abandonar la pantalla', () => {
    const limpiar = vi.fn()
    const { unmount } = renderHook(() => useAutoDismiss('Operación realizada', limpiar))
    unmount()
    act(() => vi.advanceTimersByTime(8000))
    expect(limpiar).not.toHaveBeenCalled()
  })
})
