import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdministradorUsuariosVista from '../pages/AdministradorUsuariosVista.jsx'
import { usuariosService } from '../services/usuarios.service.js'
import { colaboradoresService } from '../services/colaboradores.service.js'

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { usuarioId: 'admin-1', rol: 'ADMINISTRADOR', estado: 'ACTIVO' } }),
}))
vi.mock('../hooks/useOperationalPermissions.js', () => ({
  useOperationalPermissions: () => ({ canOperate: () => true }),
}))
vi.mock('../services/usuarios.service.js', () => ({
  usuariosService: {
    listAll: vi.fn(), create: vi.fn(), update: vi.fn(),
    changeRole: vi.fn(), changeStatus: vi.fn(),
  },
}))
vi.mock('../services/colaboradores.service.js', () => ({
  colaboradoresService: { listAll: vi.fn() },
}))
vi.mock('../components/layout/EmpleadoLogoutButton.jsx', () => ({
  default: () => null,
}))

const administradorPrincipal = {
  usuarioId: 'admin-1', nombre: 'Administrador principal',
  email: 'principal@example.com', rol: 'ADMINISTRADOR', estado: 'ACTIVO',
}
const segundoAdministrador = {
  usuarioId: 'admin-2', nombre: 'Administrador alterno',
  email: 'alterno@example.com', rol: 'ADMINISTRADOR', estado: 'ACTIVO',
}

function prepararUsuarios(items) {
  vi.mocked(usuariosService.listAll).mockResolvedValue({ data: { datos: { items } } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(colaboradoresService.listAll).mockResolvedValue({ data: { datos: { items: [] } } })
})
afterEach(cleanup)

describe('proteger al último administrador activo desde la interfaz', () => {
  it('impide seleccionar la desactivación si solo queda uno', async () => {
    prepararUsuarios([administradorPrincipal])
    render(<MemoryRouter><AdministradorUsuariosVista /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Opciones para Administrador principal' }))
    const boton = screen.getByRole('button', { name: 'Desactivar usuario' })
    expect(boton.disabled).toBe(true)
    expect(boton.title).toContain('otro administrador activo')
    expect(usuariosService.changeStatus).not.toHaveBeenCalled()
  })

  it('habilita la desactivación cuando hay un segundo administrador activo', async () => {
    prepararUsuarios([administradorPrincipal, segundoAdministrador])
    render(<MemoryRouter><AdministradorUsuariosVista /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Opciones para Administrador principal' }))
    const boton = screen.getByRole('button', { name: 'Desactivar usuario' })
    expect(boton.disabled).toBe(false)
  })

  it('no considera administrador activo a uno con estado inactivo', async () => {
    prepararUsuarios([administradorPrincipal, { ...segundoAdministrador, estado: 'INACTIVO' }])
    render(<MemoryRouter><AdministradorUsuariosVista /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Opciones para Administrador principal' }))
    expect(screen.getByRole('button', { name: 'Desactivar usuario' }).disabled).toBe(true)
  })
})
