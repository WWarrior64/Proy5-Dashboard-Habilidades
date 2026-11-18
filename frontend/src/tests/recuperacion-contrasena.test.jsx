import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from '../pages/ForgotPassword.jsx'
import { solicitarRecuperacion, confirmarRecuperacion } from '../services/cognito.service.js'

vi.mock('../services/cognito.service.js', () => ({
  solicitarRecuperacion: vi.fn(),
  confirmarRecuperacion: vi.fn(),
}))

describe('F08: recuperación de contraseña', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(solicitarRecuperacion).mockResolvedValue(undefined)
    vi.mocked(confirmarRecuperacion).mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  it('solicita código y confirma el cambio de contraseña con Cognito', async () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Correo Electrónico'), {
      target: { value: 'empleado@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    await waitFor(() => expect(solicitarRecuperacion).toHaveBeenCalledWith('empleado@example.com'))
    fireEvent.change(await screen.findByLabelText('Código de verificación'), {
      target: { value: '654321' },
    })
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'NuevaClave123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    await waitFor(() => expect(confirmarRecuperacion).toHaveBeenCalledWith(
      'empleado@example.com', '654321', 'NuevaClave123!',
    ))
    expect(await screen.findByText('Contraseña actualizada. Ya puedes iniciar sesión.')).toBeTruthy()
  })

  it('un error al solicitar código se muestra sin simular recuperación', async () => {
    vi.mocked(solicitarRecuperacion).mockRejectedValue(new Error('No fue posible enviar el código'))
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Correo Electrónico'), {
      target: { value: 'empleado@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible enviar el código')
    expect(confirmarRecuperacion).not.toHaveBeenCalled()
  })
})
