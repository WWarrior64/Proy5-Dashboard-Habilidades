import { describe, it, expect } from 'vitest'
import { API_DESARROLLO, resolverApiUrl } from '../utils/apiConfig.js'

describe('API por entorno', () => {
  it('mantiene la URL anterior durante el desarrollo local', () => {
    expect(resolverApiUrl({ desarrollo: true })).toBe(API_DESARROLLO)
  })
  it('respeta la URL explícita de cada entorno', () => {
    expect(resolverApiUrl({ direccion: ' https://otro.example/api/v1 ', desarrollo: true }))
      .toBe('https://otro.example/api/v1')
  })
  it('no usa la API de desarrollo silenciosamente en producción', () => {
    expect(resolverApiUrl({ desarrollo: false })).toBe('')
  })
})
