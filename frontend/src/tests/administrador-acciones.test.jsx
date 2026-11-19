import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useAuth } from '../context/AuthContext.jsx'
import App from '../App.jsx'

vi.mock('../context/AuthContext.jsx', () => ({
  AuthContext: { Provider: ({ children }) => children },
  AuthProvider: ({ children }) => children,
  useAuth: vi.fn(),
}))
vi.mock('../components/layout/ProtectedRoute.jsx', () => ({
  ProtectedRoute: ({ children }) => children,
}))
vi.mock('../components/layout/MainLayout.jsx', async () => {
  const { Outlet } = await import('react-router-dom')
  return { default: () => <Outlet /> }
})
vi.mock('../pages/Colaboradores.jsx', () => ({
  default: () => <h1>Gestión de colaboradores conectada</h1>,
}))
vi.mock('../pages/Proyectos.jsx', () => ({
  default: () => <h1>Gestión de proyectos conectada</h1>,
}))
vi.mock('../pages/AdministradorUsuariosVista.jsx', () => ({
  default: () => <h1>Gestión de usuarios conectada</h1>,
}))
vi.mock('../pages/AdministradorRolesPermisosVista.jsx', () => ({
  default: () => <h1>Roles y permisos conectados</h1>,
}))
vi.mock('../pages/AdministradorConfiguracionVista.jsx', () => ({
  default: () => <h1>Configuración conectada</h1>,
}))
vi.mock('../pages/dashboards/AdministradorDashboard.jsx', () => ({
  default: () => <h1>Panel de administrador</h1>,
}))

describe('Acciones rápidas del Administrador', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { usuarioId: 'admin-1', rol: 'ADMINISTRADOR', estado: 'ACTIVO' },
      loading: false,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it.each([
    ['/usuarios', 'Gestión de usuarios conectada'],
    ['/roles-permisos', 'Roles y permisos conectados'],
    ['/configuracion', 'Configuración conectada'],
  ])('un Administrador abre %s desde su dashboard', (ruta, titulo) => {
    window.history.replaceState({}, '', ruta)
    render(<App />)
    expect(screen.getByRole('heading', { name: titulo })).toBeTruthy()
  })

  it.each([
    ['/colaboradores', 'Gestión de colaboradores conectada'],
    ['/proyectos', 'Gestión de proyectos conectada'],
  ])('el Administrador no puede abrir directamente %s', async (ruta, titulo) => {
    window.history.replaceState({}, '', ruta)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Panel de administrador' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: titulo })).toBeNull()
  })
})
