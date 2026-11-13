import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdministradorAuditoriaVista from '../pages/AdministradorAuditoriaVista.jsx'
import api from '../services/api.js'

vi.mock('../services/api.js', () => ({ default: { get: vi.fn() } }))
vi.mock('../components/layout/EmpleadoLogoutButton.jsx', () => ({ default: () => null }))

describe('Auditoría del administrador', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ data: { datos: {
      items: [{
        auditoriaId: 'aud-1', fecha: new Date().toISOString(), usuarioId: 'u1',
        usuario: 'Ana García', entidad: 'Proyectos', tipo: 'CREACION',
        accion: 'registró un proyecto', descripcion: 'Registro: Portal interno',
        detalle: 'ID del recurso: p1 · Método: POST',
      }], nextCursor: null,
    } } })
  })
  afterEach(cleanup)

  it('muestra el usuario autenticado y el evento real sin atribuirlo a No registrado', async () => {
    render(<MemoryRouter><AdministradorAuditoriaVista /></MemoryRouter>)
    expect(await screen.findByText('Ana García')).toBeTruthy()
    expect(screen.getByText(/registró un proyecto/)).toBeTruthy()
    expect(screen.queryByText('No registrado')).toBeNull()
    expect(api.get).toHaveBeenCalledWith('/administracion/auditoria', expect.objectContaining({
      params: expect.objectContaining({ limite: 100 }),
    }))
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/ID del recurso: p1/)).toBeTruthy()
  })

  it('muestra una sola fecha para grupos históricos y conserva los filtros', async () => {
    const anterior = new Date(Date.now() - 7 * 86400000).toISOString()
    vi.mocked(api.get).mockResolvedValue({ data: { datos: {
      items: [{ auditoriaId: 'aud-historico', fecha: anterior,
        usuarioId: 'u1', usuario: 'Ana García', entidad: 'Proyectos',
        tipo: 'CREACION', accion: 'registró un proyecto' }], nextCursor: null,
    } } })
    render(<MemoryRouter><AdministradorAuditoriaVista /></MemoryRouter>)
    await screen.findByText('Ana García')
    const titulos = screen.getAllByRole('heading', { level: 2 })
    expect(titulos.some(titulo => /^\d{2}\/\d{2}\/\d{4}$/.test(titulo.textContent.trim()))).toBe(true)
    fireEvent.change(screen.getByLabelText('Fecha desde'), { target: { value: '2026-01-01' } })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/administracion/auditoria', expect.objectContaining({
      params: expect.objectContaining({ desde: '2026-01-01' }),
    })))
  })
})
