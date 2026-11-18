import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../services/api.js'
import { proyectosService } from '../services/proyectos.service.js'

vi.mock('../services/api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const datos = { nombre: 'Portal', descripcion: 'Proyecto web', liderId: 'lider1',
  creadoPor: 'lider1', horasRequeridas: 60, estado: 'ACTIVO' }
const requisito = id => ({ habilidadId: id, nombre: id, nivelMinimo: 'JUNIOR', esObligatoria: true })

describe('F03: creación y recuperación sin duplicados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.put).mockResolvedValue({ data: { datos: {} } })
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } })
    vi.mocked(api.patch).mockResolvedValue({ data: { datos: { estado: 'ACTIVO' } } })
  })

  it('crea un borrador, guarda habilidades y publica después de que la API lo confirma', async () => {
    let idCreado = null
    vi.mocked(api.get).mockImplementation(async url => {
      if (url.endsWith('/habilidades')) return { data: { datos: [] } }
      throw { response: { status: 404 } }
    })
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url === '/proyectos') {
        idCreado = body.proyectoId
        return { data: { datos: { ...body, estado: 'BORRADOR' } } }
      }
      return { data: { datos: body } }
    })
    const reserva = vi.fn()
    const resultado = await proyectosService.saveWorkflow({
      datos, requisitos: [requisito('react')], onDraftReserved: reserva,
    })
    expect(reserva).toHaveBeenCalledWith(idCreado)
    expect(resultado).toEqual({ proyectoId: idCreado, estado: 'ACTIVO' })
    expect(api.post).toHaveBeenCalledWith('/proyectos', expect.objectContaining({
      proyectoId: idCreado, estado: 'BORRADOR',
    }))
    expect(api.patch).toHaveBeenCalledWith('/proyectos/' + idCreado + '/estado', { estado: 'ACTIVO' })
  })

  it('si falla SQL, recupera el mismo borrador y continúa sin crear otro', async () => {
    let idCreado = null
    let sqlFallo = false
    let reactGuardada = false
    vi.mocked(api.get).mockImplementation(async url => {
      if (url.endsWith('/habilidades')) return { data: { datos: reactGuardada
        ? [{ habilidadId: 'react', nivelMinimo: 'JUNIOR', esObligatoria: true }] : [] } }
      if (idCreado) return { data: { datos: { ...datos, proyectoId: idCreado, estado: 'BORRADOR' } } }
      throw { response: { status: 404 } }
    })
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url === '/proyectos') {
        idCreado = body.proyectoId
        return { data: { datos: { ...body } } }
      }
      if (body.habilidadId === 'sql' && !sqlFallo) {
        sqlFallo = true
        throw { response: { status: 500, data: { mensaje: 'Servicio temporalmente no disponible' } } }
      }
      if (body.habilidadId === 'react') reactGuardada = true
      return { data: { datos: body } }
    })
    const reserva = vi.fn()
    await expect(proyectosService.saveWorkflow({
      datos, requisitos: [requisito('react'), requisito('sql')], onDraftReserved: reserva,
    })).rejects.toThrow(/SQL|sql/)
    expect(api.patch).not.toHaveBeenCalled()
    const reintento = await proyectosService.saveWorkflow({
      borradorId: idCreado, datos, requisitos: [requisito('react'), requisito('sql')],
    })
    expect(reintento.proyectoId).toBe(idCreado)
    expect(api.post.mock.calls.filter(([url]) => url === '/proyectos')).toHaveLength(1)
    expect(api.post.mock.calls.filter(([, body]) => body.habilidadId === 'react')).toHaveLength(1)
    expect(api.patch).toHaveBeenCalledTimes(1)
  })

  it('rechazo de publicación deja la operación sin confirmar', async () => {
    let existe = false
    vi.mocked(api.get).mockImplementation(async url => {
      if (url.endsWith('/habilidades')) return { data: { datos: [] } }
      if (!existe) throw { response: { status: 404 } }
      return { data: { datos: { ...datos, estado: 'BORRADOR' } } }
    })
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url === '/proyectos') existe = true
      return { data: { datos: body } }
    })
    vi.mocked(api.patch).mockRejectedValue({ response: { status: 409, data: { mensaje: 'Rechazado' } } })
    await expect(proyectosService.saveWorkflow({
      datos, requisitos: [requisito('react')],
    })).rejects.toMatchObject({ response: { status: 409 } })
  })

  it('edita requisitos de un proyecto existente sin volver a crearlo', async () => {
    vi.mocked(api.get).mockImplementation(async url => ({
      data: { datos: url.endsWith('/habilidades')
        ? [{ habilidadId: 'react', nivelMinimo: 'JUNIOR', esObligatoria: true }]
        : { ...datos, estado: 'ACTIVO' } },
    }))
    await proyectosService.saveWorkflow({
      proyectoId: 'p1', datos, requisitos: [{ ...requisito('react'), nivelMinimo: 'MID' }],
    })
    expect(api.put).toHaveBeenCalledWith('/proyectos/p1/habilidades/react',
      expect.objectContaining({ nivelMinimo: 'MID' }))
    expect(api.post).not.toHaveBeenCalled()
  })
})
