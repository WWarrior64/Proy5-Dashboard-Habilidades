import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
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

      const result = await login('m.torres@empresa.com', 'password123')

      expect(result.user).toEqual(mockProfile)
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
    })

    it('debe lanzar error de red cuando no hay conexión', async () => {
      const error = new Error('No se pudo conectar con API Gateway. Compruebe la conexión y CORS.')
      error.code = 'ERR_NETWORK'
      vi.mocked(cognitoSignIn).mockRejectedValue(error)

      await expect(login('test@test.com', 'pass')).rejects.toThrow('No se pudo conectar')
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