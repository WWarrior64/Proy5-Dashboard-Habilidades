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
vi.mock('../pages/Colaboradores.jsx', () => ({
  default: () => <h1>Gestión de colaboradores conectada</h1>,
}))
vi.mock('../pages/Proyectos.jsx', () => ({
  default: () => <h1>Gestión de proyectos conectada</h1>,
}))
vi.mock('../pages/AdministradorUsuariosVista.jsx', () => ({
  default: () => <h1>Gestión de usuarios conectada</h1>,
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
    ['/colaboradores', 'Gestión de colaboradores conectada'],
    ['/proyectos', 'Gestión de proyectos conectada'],
  ])('un Administrador abre %s desde su dashboard sin caer en el layout genérico', (ruta, titulo) => {
    window.history.replaceState({}, '', ruta)
    render(<App />)
    expect(screen.getByRole('heading', { name: titulo })).toBeTruthy()
  })
})
