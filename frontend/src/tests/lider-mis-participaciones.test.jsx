import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MisParticipaciones from '../components/asignaciones/MisParticipaciones.jsx'
import { asignacionesService } from '../services/asignaciones.service.js'
import { proyectosService } from '../services/proyectos.service.js'

vi.mock('../services/asignaciones.service.js', () => ({
  asignacionesService: { listMine: vi.fn() },
}))
vi.mock('../services/proyectos.service.js', () => ({
  proyectosService: { get: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(asignacionesService.listMine).mockResolvedValue({
    data: { datos: { tienePerfil: true, items: [
      { asignacionId: 'a1', colaboradorId: 'col-lider', proyectoId: 'proyecto-ajeno',
        porcentajeDedicacion: 30, horasAsignadas: 40, horasCompletadas: 8,
        estado: 'ACTIVA' },
      { asignacionId: 'a2', colaboradorId: 'col-lider', proyectoId: 'proyecto-anterior',
        porcentajeDedicacion: 15, horasAsignadas: 20, horasCompletadas: 20,
        estado: 'FINALIZADA' },
    ] } },
  })
  vi.mocked(proyectosService.get).mockImplementation(async id => ({
    data: { datos: {
      proyectoId: id, liderId: 'lider-diferente',
      nombre: id === 'proyecto-ajeno' ? 'Proyecto de otro líder' : 'Proyecto anterior',
      fechaInicio: '2026-11-13', horasRequeridas: 40,
    } },
  }))
})
afterEach(cleanup)

describe('Mis participaciones del líder como colaborador', () => {
  it('consulta las asignaciones por su perfil, muestra el proyecto ajeno y no ofrece acciones de administración', async () => {
    render(<MisParticipaciones />)
    expect(await screen.findByText('Proyecto de otro líder')).toBeTruthy()
    expect(asignacionesService.listMine).toHaveBeenCalledWith()
    expect(proyectosService.get).toHaveBeenCalledWith('proyecto-ajeno')
    expect(screen.getAllByText('30 %').length).toBeGreaterThan(0)
    expect(screen.queryByText('Proyecto anterior')).toBeNull()
    expect(screen.queryByRole('button', { name: /editar|desvincular|finalizar/i })).toBeNull()

    fireEvent.change(screen.getByLabelText('Filtrar mis participaciones por estado'), {
      target: { value: 'TODOS' },
    })
    expect(screen.getByText('Proyecto anterior')).toBeTruthy()
  })

  it('informa cuando el usuario no tiene perfil de colaborador, sin mostrar un error de permisos', async () => {
    vi.mocked(asignacionesService.listMine).mockResolvedValue({
      data: { datos: { tienePerfil: false, items: [] } },
    })
    render(<MisParticipaciones />)
    expect(await screen.findByText(/No tienes un perfil de colaborador registrado/)).toBeTruthy()
    expect(screen.queryByText(/No hay participaciones que coincidan/)).toBeNull()
  })

  it('muestra el rechazo 403 sin presentar falsamente una lista vacía', async () => {
    vi.mocked(asignacionesService.listMine).mockRejectedValue({
      response: { status: 403, data: { mensaje: 'Permisos insuficientes' } },
    })
    render(<MisParticipaciones />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(/No hay participaciones que coincidan/)).toBeNull()
    expect(screen.queryByText(/asignaciones activas/)).toBeNull()
  })
})
