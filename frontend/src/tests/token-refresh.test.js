import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/cognito.service.js', () => ({
  refreshSession: vi.fn(),
  getAccessToken: vi.fn(),
  getIdToken: vi.fn(),
  getRefreshToken: vi.fn(),
  decodeJwtPayload: vi.fn(),
  clearTokens: vi.fn(),
}))

describe('Token Refresh Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('debe exportar funciones esperadas', async () => {
    const mod = await import('../services/token-refresh.service.js')
    expect(typeof mod.startAutoRefresh).toBe('function')
    expect(typeof mod.stopAutoRefresh).toBe('function')
    expect(typeof mod.getValidIdToken).toBe('function')
    expect(typeof mod.cleanup).toBe('function')
  })

  it('cleanup debe detener timer y limpiar tokens', async () => {
    const { cleanup, stopAutoRefresh } = await import('../services/token-refresh.service.js')
    const { clearTokens } = await import('../services/cognito.service.js')
    
    stopAutoRefresh()
    cleanup()
    
    expect(clearTokens).toHaveBeenCalled()
  })
})