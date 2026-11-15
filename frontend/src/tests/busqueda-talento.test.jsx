import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '../services/api.js'
import { busquedaService } from '../services/busqueda.service.js'

vi.mock('../services/api.js', () => ({
  default: { get: vi.fn() },
}))

describe('F01: buscador de talento', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envía proyecto seleccionado, varias habilidades, nivel mínimo y disponibilidad', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { datos: { total: 1, candidatos: [{
      colaboradorId: 'c1', puntuacion: 75,
      habilidadesCoincidentes: [{ habilidadId: 'react' }],
      habilidadesFaltantes: [{ habilidadId: 'sql' }],
    }] } } })
    const resultado = await busquedaService.colaboradores({
      proyectoId: 'p1', habilidades: ['react', 'sql', 'react'],
      nivelMinimo: 'MID', considerarDisponibilidad: true,
    })
    expect(api.get).toHaveBeenCalledWith('/busqueda/colaboradores', {
      params: {
        proyectoId: 'p1', habilidades: 'react,sql',
        nivelMinimo: 'MID', tipoCoincidencia: 'alguna',
        considerarDisponibilidad: true, limit: 100,
      },
    })
    expect(resultado.data.datos.candidatos[0].puntuacion).toBe(75)
    expect(resultado.data.datos.candidatos[0].habilidadesFaltantes[0].habilidadId).toBe('sql')
  })

  it('sin coincidencias devuelve la respuesta vacía de la API', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { datos: { total: 0, candidatos: [] } } })
    const respuesta = await busquedaService.colaboradores({ habilidades: ['sql'] })
    expect(respuesta.data.datos.candidatos).toEqual([])
  })

  it('puede incluir colaboradores no disponibles para el filtro visual', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { datos: { candidatos: [] } } })
    await busquedaService.colaboradores({ habilidades: ['sql'], considerarDisponibilidad: false })
    expect(api.get).toHaveBeenCalledWith('/busqueda/colaboradores', expect.objectContaining({
      params: expect.objectContaining({ considerarDisponibilidad: false }),
    }))
  })

  it('propaga errores del backend para mostrar un aviso', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 409, data: { mensaje: 'Conflicto' } } })
    await expect(busquedaService.colaboradores({ habilidades: ['react'] })).rejects.toMatchObject({
      response: { status: 409 },
    })
  })

  it('sin habilidades no realiza ninguna petición', async () => {
    const respuesta = await busquedaService.colaboradores({ habilidades: [] })
    expect(respuesta.data.datos.candidatos).toEqual([])
    expect(api.get).not.toHaveBeenCalled()
  })
})
