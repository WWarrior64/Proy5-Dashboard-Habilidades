import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VerificacionCorreo from '../components/usuarios/VerificacionCorreo.jsx'
import {
  obtenerEstadoVerificacionCorreo,
  solicitarVerificacionCorreo,
  confirmarVerificacionCorreo,
} from '../services/cognito.service.js'

vi.mock('../services/cognito.service.js', () => ({
  obtenerEstadoVerificacionCorreo: vi.fn(),
  solicitarVerificacionCorreo: vi.fn(),
  confirmarVerificacionCorreo: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(solicitarVerificacionCorreo).mockResolvedValue()
  vi.mocked(confirmarVerificacionCorreo).mockResolvedValue()
})
afterEach(cleanup)

describe('verificación de correo registrado en Cognito', () => {
  it('muestra el correo confirmado sin pedir otro código', async () => {
    vi.mocked(obtenerEstadoVerificacionCorreo).mockResolvedValue({
      email: 'empleado@example.com', verificado: true,
    })
    render(<VerificacionCorreo email="empleado@example.com" />)
    expect(await screen.findByText(/Correo verificado en Amazon Cognito/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Enviar código de verificación/ })).toBeNull()
  })

  it('envía un código y solo confirma el correo después de validarlo', async () => {
    vi.mocked(obtenerEstadoVerificacionCorreo).mockResolvedValue({
      email: 'empleado@example.com', verificado: false,
    })
    render(<VerificacionCorreo email="empleado@example.com" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar código de verificación' }))
    await waitFor(() => expect(solicitarVerificacionCorreo).toHaveBeenCalledOnce())
    fireEvent.change(await screen.findByLabelText('Código de verificación'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar correo' }))
    await waitFor(() => expect(confirmarVerificacionCorreo).toHaveBeenCalledWith('123456'))
    expect(await screen.findByText(/Correo verificado en Amazon Cognito/)).toBeTruthy()
  })

  it('no marca el correo como verificado si Cognito rechaza el código', async () => {
    vi.mocked(obtenerEstadoVerificacionCorreo).mockResolvedValue({
      email: 'empleado@example.com', verificado: false,
    })
    vi.mocked(confirmarVerificacionCorreo).mockRejectedValue(new Error('Código inválido'))
    render(<VerificacionCorreo email="empleado@example.com" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar código de verificación' }))
    fireEvent.change(await screen.findByLabelText('Código de verificación'), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar correo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido')
    expect(screen.getByRole('button', { name: 'Confirmar correo' })).toBeTruthy()
  })
})
