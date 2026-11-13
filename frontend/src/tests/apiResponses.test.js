import { describe, it, expect } from 'vitest'
import {
  extractItems,
  extractData,
  extractPaginated,
  isSuccess,
  extractErrorMessage,
  fetchAllPages,
} from '../utils/apiResponses.js'

describe('API Responses Utility', () => {
  describe('extractItems', () => {
    it('debe extraer arreglo de datos', () => {
      expect(extractItems({ datos: [{ id: 1 }, { id: 2 }] })).toEqual([{ id: 1 }, { id: 2 }])
    })

    it('debe extraer items de datos.items', () => {
      expect(extractItems({ datos: { items: [{ id: 1 }], lastKey: null } })).toEqual([{ id: 1 }])
    })

    it('debe devolver vacío para respuesta nula', () => {
      expect(extractItems(null)).toEqual([])
      expect(extractItems(undefined)).toEqual([])
    })

    it('debe devolver arreglo directo', () => {
      expect(extractItems([{ id: 1 }])).toEqual([{ id: 1 }])
    })
  })

  describe('extractData', () => {
    it('debe extraer datos del objeto', () => {
      expect(extractData({ datos: { usuarioId: 'usr_1' } })).toEqual({ usuarioId: 'usr_1' })
    })

    it('debe retornar null para respuesta nula', () => {
      expect(extractData(null)).toBeNull()
    })
  })

  describe('extractPaginated', () => {
    it('debe extraer paginación', () => {
      const result = extractPaginated({
        datos: { items: [{ id: 1 }], lastKey: 'key_123' },
      })
      expect(result.items).toEqual([{ id: 1 }])
      expect(result.lastKey).toBe('key_123')
    })

    it('debe devolver vacío para respuesta nula', () => {
      expect(extractPaginated(null)).toEqual({ items: [], lastKey: null })
    })
  })

  describe('fetchAllPages', () => {
    it('recorre todos los cursores sin perder elementos', async () => {
      const vistos = []
      const respuesta = await fetchAllPages(async params => {
        vistos.push(params)
        return { data: { datos: params.cursor
          ? { items: [{ id: 2 }], nextCursor: null }
          : { items: [{ id: 1 }], nextCursor: 'pagina-2' } } }
      }, 25)
      expect(respuesta.data.datos.items).toEqual([{ id: 1 }, { id: 2 }])
      expect(vistos).toEqual([{ limit: 25 }, { limit: 25, cursor: 'pagina-2' }])
    })

    it('rechaza cursores repetidos para evitar peticiones infinitas', async () => {
      await expect(fetchAllPages(async () => ({
        data: { datos: { items: [], nextCursor: 'repetido' } },
      }))).rejects.toThrow('cursor de paginación repetido')
    })
  })

  describe('isSuccess', () => {
    it('debe detectar éxito', () => {
      expect(isSuccess({ success: true })).toBe(true)
      expect(isSuccess({ success: false })).toBe(false)
      expect(isSuccess(null)).toBe(false)
    })
  })

  describe('extractErrorMessage', () => {
    it('debe extraer mensaje de error', () => {
      expect(extractErrorMessage({ error: { mensaje: 'Error de prueba' } })).toBe('Error de prueba')
    })

    it('debe retornar null para respuesta nula', () => {
      expect(extractErrorMessage(null)).toBeNull()
    })
  })
})