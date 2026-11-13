import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LiderProyectosVista from '../pages/LiderProyectosVista.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { proyectosService } from '../services/proyectos.service.js'
import { habilidadesService } from '../services/habilidades.service.js'
import api from '../services/api.js'

vi.mock('../hooks/useAuth.js', () => ({ useAuth: vi.fn() }))
vi.mock('../components/layout/EmpleadoLogoutButton.jsx', () => ({
  default: () => <span>Cerrar sesión</span>,
}))
vi.mock('../services/proyectos.service.js', () => ({
  proyectosService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))
vi.mock('../services/habilidades.service.js', () => ({
  habilidadesService: { listAll: vi.fn() },
}))
vi.mock('../services/api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('Habilidades requeridas al publicar un proyecto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({ user: { usuarioId: 'lider-1', rol: 'LIDER_PROYECTO' } })
    vi.mocked(proyectosService.list).mockResolvedValue({ data: { datos: [] } })
    vi.mocked(proyectosService.create).mockResolvedValue({ data: { datos: { proyectoId: 'p1' } } })
    vi.mocked(proyectosService.update).mockResolvedValue({ data: { success: true } })
    vi.mocked(habilidadesService.listAll).mockResolvedValue({ data: {
      datos: { items: [{ habilidadId: 'hab-1', nombre: 'JavaScript', estado: 'ACTIVO' }] },
    } })
    vi.mocked(api.get).mockResolvedValue({ data: { datos: [] } })
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } })
  })

  afterEach(cleanup)

  it('obliga a seleccionar habilidades para publicar y las guarda antes de activar', async () => {
    render(<MemoryRouter><LiderProyectosVista /></MemoryRouter>)
    const abrir = await screen.findByRole('button', { name: 'Nuevo proyecto' })
    await waitFor(() => expect(abrir.disabled).toBe(false))
    fireEvent.click(abrir)
    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Nuevo portal' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Integrar nuevas funciones' } })
    fireEvent.change(screen.getByLabelText('Horas requeridas'), { target: { value: '40' } })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'ACTIVO' } })

    fireEvent.click(screen.getByRole('button', { name: 'Publicar proyecto' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('Selecciona al menos una habilidad requerida'))
    expect(proyectosService.create).not.toHaveBeenCalled()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Añadir habilidad' }).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Añadir habilidad' }))
    expect(screen.getByLabelText('Nivel mínimo').value).toBe('JUNIOR')
    fireEvent.click(screen.getByRole('button', { name: 'Publicar proyecto' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/proyectos/p1/habilidades', {
      habilidadId: 'hab-1', nivelMinimo: 'JUNIOR', esObligatoria: true,
    }))
    expect(proyectosService.create).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Nuevo portal', estado: 'BORRADOR', liderId: 'lider-1',
    }))
    expect(proyectosService.update).toHaveBeenCalledWith('p1', { estado: 'ACTIVO' })
  })
})
