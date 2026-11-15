import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../services/api.js'
import { postulacionesService } from '../services/postulaciones.service.js'

vi.mock('../services/api.js', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
}))

describe('F06: operaciones de postulaciones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crea una postulación nueva pendiente', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { datos: { estado: 'PENDIENTE' } } })
    const respuesta = await postulacionesService.create({ proyectoId: 'p1', colaboradorId: 'c1' })
    expect(api.post).toHaveBeenCalledWith('/postulaciones', { proyectoId: 'p1', colaboradorId: 'c1' })
    expect(respuesta.data.datos.estado).toBe('PENDIENTE')
  })

  it('retira una postulación mediante su ruta específica, sin borrarla', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { datos: { estado: 'RETIRADA' } } })
    const respuesta = await postulacionesService.withdraw('p1', 'c1')
    expect(api.patch).toHaveBeenCalledWith('/proyectos/p1/postulaciones/c1/retirar', {})
    expect(respuesta.data.datos.estado).toBe('RETIRADA')
  })

  it.each(['ACEPTADA', 'RECHAZADA'])('envía el estado %s y el revisor al backend', async estado => {
    vi.mocked(api.patch).mockResolvedValue({ data: { datos: { estado } } })
    await postulacionesService.decide('p1', 'c1', { estado, revisadoPor: 'lider1' })
    expect(api.patch).toHaveBeenCalledWith('/proyectos/p1/postulaciones/c1/estado',
      { estado, revisadoPor: 'lider1' })
  })

  it.each([['decisión repetida', 409], ['falta de disponibilidad', 400]])(
    'propaga el error por %s para no confirmar una aceptación ficticia', async (_caso, status) => {
      vi.mocked(api.patch).mockRejectedValue({ response: { status } })
      await expect(postulacionesService.decide('p1', 'c1', {
        estado: 'ACEPTADA', revisadoPor: 'lider1', porcentajeDedicacion: 25, horasAsignadas: 20,
      })).rejects.toMatchObject({ response: { status } })
    },
  )
})
