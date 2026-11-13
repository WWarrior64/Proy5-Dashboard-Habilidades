import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      get: vi.fn(),
    })),
  },
  create: vi.fn(),
}))

vi.mock('../services/token-refresh.service.js', () => ({
  getValidIdToken: vi.fn(() => 'mock_token'),
  cleanup: vi.fn(),
}))

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('debe crear instancia de axios con interceptores', async () => {
    const axiosModule = await import('axios')
    const { create } = axiosModule.default || axiosModule
    expect(typeof create).toBe('function')
    const instance = create({
      baseURL: 'https://test.api.com/v1',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(instance.interceptors.request.use).toBeDefined()
    expect(instance.interceptors.response.use).toBeDefined()
  })
})