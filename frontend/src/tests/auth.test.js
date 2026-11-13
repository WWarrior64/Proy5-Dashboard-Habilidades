import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../services/cognito.service.js', () => ({
  signIn: vi.fn(),
  completeNewPassword: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn(),
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  isAuthenticated: vi.fn(),
  clearTokens: vi.fn(),
  storeTokens: vi.fn(),
}))

vi.mock('../services/token-refresh.service.js', () => ({
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: vi.fn(),
  getValidIdToken: vi.fn(),
  cleanup: vi.fn(),
}))

import {
  login,
  completePasswordChange,
  refresh as authRefresh,
  logout,
  isAuthenticated,
  getToken,
} from '../services/auth.service.js'
import {
  signIn as cognitoSignIn,
  completeNewPassword as cognitoCompleteNewPassword,
  refreshSession as cognitoRefreshSession,
  signOut as cognitoSignOut,
  getIdToken,
  isAuthenticated as cognitoIsAuthenticated,
} from '../services/cognito.service.js'

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('login', () => {
    it('debe autenticar y retornar perfil de usuario', async () => {
      const mockTokens = { idToken: 'id_token', accessToken: 'access_token', refreshToken: 'refresh_token' }
      const mockProfile = {
        usuarioId: 'usr_001',
        nombre: 'María Torres',
        email: 'm.torres@empresa.com',
        rol: 'RRHH',
        estado: 'ACTIVO',
      }

      vi.mocked(cognitoSignIn).mockResolvedValue(mockTokens)
      const api = (await import('../services/api.js')).default
      vi.mocked(api.get).mockResolvedValue({ data: { datos: mockProfile } })
      const accesoRegistrado = { ...mockProfile, ultimoAcceso: '2026-11-13T18:00:00.000Z' }
      vi.mocked(api.post).mockResolvedValue({ data: { datos: accesoRegistrado } })

      const result = await login('m.torres@empresa.com', 'password123')

      expect(result.user).toEqual(accesoRegistrado)
      expect(api.post).toHaveBeenCalledTimes(1)
      expect(api.post).toHaveBeenCalledWith('/usuarios/yo/acceso')
      expect(result.tokens).toEqual(mockTokens)
      expect(cognitoSignIn).toHaveBeenCalledWith('m.torres@empresa.com', 'password123')
    })

    it('debe lanzar error cuando el perfil está inactivo', async () => {
      vi.mocked(cognitoSignIn).mockResolvedValue({ idToken: 't', accessToken: 't', refreshToken: 't' })
      const api = (await import('../services/api.js')).default
      vi.mocked(api.get).mockResolvedValue({
        data: { datos: { usuarioId: 'usr_004', estado: 'INACTIVO' } },
      })

      await expect(login('s.ramirez@empresa.com', 'password123')).rejects.toThrow('inactivo')
      expect(api.post).not.toHaveBeenCalled()
    })

    it('debe lanzar error de red cuando no hay conexión', async () => {
      const error = new Error('No se pudo conectar con API Gateway. Compruebe la conexión y CORS.')
      error.code = 'ERR_NETWORK'
      vi.mocked(cognitoSignIn).mockRejectedValue(error)

      await expect(login('test@test.com', 'pass')).rejects.toThrow('No se pudo conectar')
    })
  })

  describe('registro de acceso tras completar contraseña', () => {
    it('registra un nuevo acceso con la sesión Cognito ya confirmada', async () => {
      const api = (await import('../services/api.js')).default
      const perfil = { usuarioId: 'usr_001', estado: 'ACTIVO' }
      const actualizado = { ...perfil, ultimoAcceso: '2026-11-13T18:45:00.000Z' }
      const tokens = { idToken: 'id_token', accessToken: 'access_token', refreshToken: 'refresh_token' }
      vi.mocked(cognitoCompleteNewPassword).mockResolvedValue(tokens)
      vi.mocked(api.get).mockResolvedValue({ data: { datos: perfil } })
      vi.mocked(api.post).mockResolvedValue({ data: { datos: actualizado } })
      expect((await completePasswordChange('password_nueva')).user).toEqual(actualizado)
      expect(api.post).toHaveBeenCalledWith('/usuarios/yo/acceso')
      expect(api.post).toHaveBeenCalledTimes(1)
    })

    it('permite iniciar sesión si el backend antiguo todavía no dispone de la ruta', async () => {
      const api = (await import('../services/api.js')).default
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(cognitoSignIn).mockResolvedValue({ idToken: 'id', accessToken: 'access', refreshToken: 'refresh' })
      vi.mocked(api.get).mockResolvedValue({ data: { datos: { usuarioId: 'usr_1', estado: 'ACTIVO' } } })
      vi.mocked(api.post).mockRejectedValue({ response: { status: 404 }, message: 'Ruta no desplegada' })
      expect((await login('usuario@example.com', 'clave')).user.usuarioId).toBe('usr_1')
      expect(warn).toHaveBeenCalledOnce()
      expect(cognitoSignOut).not.toHaveBeenCalled()
    })
  })

  describe('isAuthenticated', () => {
    it('debe retornar true cuando hay token de Cognito', () => {
      vi.mocked(cognitoIsAuthenticated).mockReturnValue(true)
      expect(isAuthenticated()).toBe(true)
    })

    it('debe retornar false cuando no hay token', () => {
      vi.mocked(cognitoIsAuthenticated).mockReturnValue(false)
      expect(isAuthenticated()).toBe(false)
    })
  })

  describe('logout', () => {
    it('debe llamar a signOut de Cognito', async () => {
      vi.mocked(cognitoSignOut).mockResolvedValue(undefined)
      await logout()
      expect(cognitoSignOut).toHaveBeenCalled()
    })
  })
})