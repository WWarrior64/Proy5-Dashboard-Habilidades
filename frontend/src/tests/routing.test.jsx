import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { canAccessRoute } from '../utils/permissions.js'
import { ROLES, ROUTE_PATHS } from '../utils/constants.js'

// Mock AuthContext
vi.mock('../context/AuthContext.jsx', () => ({
  AuthContext: { Provider: ({ children }) => children },
  useAuth: vi.fn(() => ({ user: null, loading: false })),
}))

describe('Routing Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('canAccessRoute', () => {
    it('ADMINISTRADOR puede acceder a todas las rutas administrativas', () => {
      expect(canAccessRoute(ROLES.ADMINISTRADOR, '/usuarios')).toBe(true)
      expect(canAccessRoute(ROLES.ADMINISTRADOR, '/colaboradores')).toBe(true)
      expect(canAccessRoute(ROLES.ADMINISTRADOR, '/cargos')).toBe(true)
      expect(canAccessRoute(ROLES.ADMINISTRADOR, '/dashboards/administrador')).toBe(true)
    })

    it('EMPLEADO no puede acceder a rutas de administración', () => {
      expect(canAccessRoute(ROLES.EMPLEADO, '/usuarios')).toBe(false)
      expect(canAccessRoute(ROLES.EMPLEADO, '/dashboards/administrador')).toBe(false)
    })

    it('RRHH puede acceder a usuarios y colaboradores', () => {
      expect(canAccessRoute(ROLES.RRHH, '/usuarios')).toBe(true)
      expect(canAccessRoute(ROLES.RRHH, '/colaboradores')).toBe(true)
    })

    it('LIDER_PROYECTO puede acceder a búsqueda', () => {
      expect(canAccessRoute(ROLES.LIDER_PROYECTO, '/busqueda')).toBe(true)
    })

    it('cualquier rol puede acceder a su propio perfil', () => {
      expect(canAccessRoute(ROLES.EMPLEADO, '/perfil')).toBe(true)
      expect(canAccessRoute(ROLES.ADMINISTRADOR, '/perfil')).toBe(true)
    })
  })

  describe('ROUTE_PATHS', () => {
    it('debe incluir rutas nuevas de Cargos y Búsqueda', () => {
      expect(ROUTE_PATHS.CARGOS).toBe('/cargos')
      expect(ROUTE_PATHS.BUSQUEDA).toBe('/busqueda')
    })

    it('debe tener rutas de dashboard por rol', () => {
      expect(ROUTE_PATHS.DASHBOARD_EMPLEADO).toBe('/dashboards/empleado')
      expect(ROUTE_PATHS.DASHBOARD_RRHH).toBe('/dashboards/rrhh')
      expect(ROUTE_PATHS.DASHBOARD_LIDER).toBe('/dashboards/lider')
      expect(ROUTE_PATHS.DASHBOARD_ADMIN).toBe('/dashboards/administrador')
    })
  })
})