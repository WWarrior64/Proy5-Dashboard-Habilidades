import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AvisoSinPerfilColaborador, {
  esAvisoSinPerfilColaborador,
} from '../components/common/AvisoSinPerfilColaborador.jsx'

describe('Aviso temporal compartido de las vistas del empleado', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('reconoce el error de perfil ausente, pero no otros errores', () => {
    expect(esAvisoSinPerfilColaborador('El usuario no tiene un perfil de colaborador')).toBe(true)
    expect(esAvisoSinPerfilColaborador('La cuenta no tiene un perfil de colaborador.')).toBe(true)
    expect(esAvisoSinPerfilColaborador('No hay un perfil de colaborador asociado.')).toBe(true)
    expect(esAvisoSinPerfilColaborador('No fue posible conectar con el servidor')).toBe(false)
    expect(esAvisoSinPerfilColaborador('Permiso denegado')).toBe(false)
  })

  it('aparece como aviso flotante y desaparece después de seis segundos', () => {
    render(<AvisoSinPerfilColaborador mensaje="La cuenta no tiene un perfil de colaborador." />)
    expect(screen.getByRole('status').classList.contains('aviso-sin-perfil-colaborador')).toBe(true)
    act(() => vi.advanceTimersByTime(5999))
    expect(screen.getByRole('status')).toBeTruthy()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('reinicia el aviso si cambia el mensaje sin navegar a otra vista', () => {
    const { rerender } = render(<AvisoSinPerfilColaborador mensaje="La cuenta no tiene un perfil de colaborador." />)
    act(() => vi.advanceTimersByTime(6000))
    expect(screen.queryByRole('status')).toBeNull()
    rerender(<AvisoSinPerfilColaborador mensaje="El usuario no tiene un perfil de colaborador" />)
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
