import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Services Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('debe exportar módulos de servicio principales', async () => {
    const auth = await import('../services/auth.service.js')
    expect(typeof auth.login).toBe('function')
    expect(typeof auth.logout).toBe('function')
    expect(typeof auth.isAuthenticated).toBe('function')

    const api = await import('../services/api.js')
    expect(api.api).toBeDefined()

    const cognito = await import('../services/cognito.service.js')
    expect(typeof cognito.signIn).toBe('function')

    const tokenRefresh = await import('../services/token-refresh.service.js')
    expect(typeof tokenRefresh.cleanup).toBe('function')
  })
})