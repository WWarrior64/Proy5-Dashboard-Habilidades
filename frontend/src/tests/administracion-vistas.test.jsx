import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdministradorRolesPermisosVista from '../pages/AdministradorRolesPermisosVista.jsx'
import AdministradorConfiguracionVista from '../pages/AdministradorConfiguracionVista.jsx'
import { usuariosService } from '../services/usuarios.service.js'
import { administracionService } from '../services/administracion.service.js'
import { resolverPoliticaAdministrativa } from '../utils/administracionPermisos.js'

vi.mock('../components/layout/EmpleadoLogoutButton.jsx', () => ({ default: () => null }))
vi.mock('../services/usuarios.service.js', () => ({
  usuariosService: { listAll: vi.fn() },
}))
vi.mock('../services/administracion.service.js', () => ({
  administracionService: { getRolesPermisos: vi.fn(), saveRolesPermisos: vi.fn(),
    getConfiguracion: vi.fn(), saveConfiguracion: vi.fn() },
}))

describe('Roles, permisos y configuración de Administración', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usuariosService.listAll).mockResolvedValue({ data: { datos: { items: [] } } })
  })
  afterEach(cleanup)

  it('muestra los ocho permisos oficiales si el servidor devuelve solamente dos antiguos', async () => {
    vi.mocked(administracionService.getRolesPermisos).mockResolvedValue({
      data: { datos: { version: 1, roles: [], permisos: [
        { id: 'colaboradores', nombre: 'Gestionar colaboradores', roles: [] },
        { id: 'postulaciones', nombre: 'Revisar postulaciones', roles: ['EMPLEADO'] },
      ] } },
    })
    render(<MemoryRouter><AdministradorRolesPermisosVista /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Gestionar cargos' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12)
    expect(screen.getByRole('heading', { name: 'RRHH' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Gestionar asignaciones' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Consultar Gestionar colaboradores' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Configurar Gestionar colaboradores' })).toBeNull()
  })

  it('permite configurar RRHH cuando la API usa el catálogo oficial completo', async () => {
    const politica = resolverPoliticaAdministrativa(null)
    vi.mocked(administracionService.getRolesPermisos).mockResolvedValue({
      data: { datos: { version: 2, roles: politica.roles, permisos: politica.permisos } },
    })
    render(<MemoryRouter><AdministradorRolesPermisosVista /></MemoryRouter>)
    const boton = await screen.findByRole('button', { name: 'Configurar permisos de RRHH' })
    fireEvent.click(boton)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Operaciones permitidas para el rol')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Gestionar colaboradores' }).checked).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Gestionar cargos' }).checked).toBe(true)
    expect(screen.getByRole('button', { name: 'Consultar permisos de Administrador' })).toBeTruthy()
  })

  it('muestra el ojo en reglas fijas y abre su detalle sin editarlo', async () => {
    vi.mocked(administracionService.getConfiguracion).mockResolvedValue({ data: { datos: null } })
    render(<MemoryRouter><AdministradorConfiguracionVista /></MemoryRouter>)
    const consultar = await screen.findByRole('button', { name: 'Consultar Límite de dedicación por colaborador' })
    expect(screen.queryByRole('button', { name: 'Editar Límite de dedicación por colaborador' })).toBeNull()
    fireEvent.click(consultar)
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('100 %')).toBeTruthy()
    expect(within(dialogo).queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Editar Días de actividad del dashboard' })).toBeTruthy()
  })
})
