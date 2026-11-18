import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdministradorDashboard from '../pages/dashboards/AdministradorDashboard.jsx'
import { usuariosService } from '../services/usuarios.service.js'
import { proyectosService } from '../services/proyectos.service.js'
import { administracionService } from '../services/administracion.service.js'
import api from '../services/api.js'

vi.mock('../services/usuarios.service.js', () => ({
  usuariosService: { listAll: vi.fn() },
}))
vi.mock('../services/proyectos.service.js', () => ({
  proyectosService: { list: vi.fn() },
}))
vi.mock('../services/administracion.service.js', () => ({
  administracionService: { getConfiguracion: vi.fn() },
}))
vi.mock('../services/api.js', () => ({
  default: { get: vi.fn() },
}))
vi.mock('../components/layout/EmpleadoLogoutButton.jsx', () => ({
  default: () => null,
}))

const usuarios = Array.from({ length: 7 }, (_, indice) => ({
  usuarioId: 'u' + (indice + 1),
  nombre: 'Usuario ' + (indice + 1),
  email: 'u' + (indice + 1) + '@example.com',
  rol: 'EMPLEADO',
  estado: 'ACTIVO',
  fechaCreacion: '2026-11-' + String(indice + 1).padStart(2, '0') + 'T12:00:00.000Z',
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(usuariosService.listAll).mockResolvedValue({ data: { datos: { items: usuarios } } })
  vi.mocked(proyectosService.list).mockResolvedValue({ data: { datos: [] } })
  vi.mocked(administracionService.getConfiguracion).mockResolvedValue({ data: { datos: null } })
  vi.mocked(api.get).mockResolvedValue({
    data: { datos: { eventos: Array.from({ length: 7 }, (_, indice) => ({
      tipo: 'proyecto', id: 'p' + (indice + 1),
      nombre: 'Proyecto ' + (indice + 1),
      fecha: '2026-11-' + String(indice + 1).padStart(2, '0') + 'T12:00:00.000Z',
      estado: 'ACTIVO',
    })) } },
  })
})
afterEach(cleanup)

describe('Dashboard del administrador con información reciente', () => {
  it('aplica los días y el tamaño de página configurados desde el backend', async () => {
    vi.mocked(administracionService.getConfiguracion).mockResolvedValue({ data: { datos: {
      parametros: [
        { id: 'dias-actividad-dashboard', valor: '14' },
        { id: 'registros-pagina-dashboard', valor: '3' },
      ],
    } } })
    render(<MemoryRouter><AdministradorDashboard /></MemoryRouter>)
    expect(await screen.findByText('Usuario 7')).toBeTruthy()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/dashboard/actividad', {
      params: { dias: 14, limite: 100 },
    }))
    expect(screen.queryByText('Usuario 4')).toBeNull()
    const paginador = within(screen.getByLabelText('Paginación de usuarios recientes'))
    fireEvent.click(paginador.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Usuario 4')).toBeTruthy()
  })

  it('ordena registros reales, pagina actividades y usuarios y permite actualizar', async () => {
    render(<MemoryRouter><AdministradorDashboard /></MemoryRouter>)
    expect(await screen.findByText('Usuario 7')).toBeTruthy()
    expect(screen.queryByText('Usuario 1')).toBeNull()
    expect(screen.getByText('Proyecto 7')).toBeTruthy()
    expect(screen.queryByText('Proyecto 1')).toBeNull()

    const usuariosPaginador = within(screen.getByLabelText('Paginación de usuarios recientes'))
    fireEvent.click(usuariosPaginador.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Usuario 1')).toBeTruthy()

    const actividadPaginador = within(screen.getByLabelText('Paginación de actividad reciente'))
    fireEvent.click(actividadPaginador.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Proyecto 1')).toBeTruthy()

    fireEvent.click(usuariosPaginador.getByRole('button', { name: 'Anterior' }))
    vi.mocked(usuariosService.listAll).mockResolvedValueOnce({
      data: { datos: { items: [...usuarios, {
        usuarioId: 'u8', nombre: 'Usuario 8', email: 'u8@example.com',
        rol: 'LIDER_PROYECTO', estado: 'ACTIVO',
        fechaCreacion: '2026-11-18T12:00:00.000Z',
      }] } },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByText('Usuario 8')).toBeTruthy()
    expect(screen.getByText('Líder de proyecto')).toBeTruthy()
    await waitFor(() => expect(usuariosService.listAll).toHaveBeenCalledTimes(2))
  })
})
