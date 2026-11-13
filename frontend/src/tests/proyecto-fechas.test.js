import { describe, expect, it } from 'vitest'
import { estimarFinProyecto, obtenerFechasProyecto, rangoFechasProyecto } from '../utils/proyectoFechas.js'

describe('Fechas estimadas de proyectos', () => {
  it('cuenta la primera jornada y no incluye fines de semana', () => {
    expect(estimarFinProyecto('2026-11-13', 8)).toBe('2026-11-13')
    expect(estimarFinProyecto('2026-11-13', 40)).toBe('2026-11-19')
    expect(estimarFinProyecto('2026-11-14', 8)).toBe('2026-11-16')
  })

  it('usa la fecha de publicación y presenta la finalización como estimada', () => {
    const fechas = obtenerFechasProyecto({
      estado: 'ACTIVO', fechaPublicacion: '2026-11-13T18:30:00.000Z', horasRequeridas: 40,
    })
    expect(fechas).toMatchObject({ inicio: '2026-11-13', fin: '2026-11-19', estimada: true, origenInicio: 'publicación' })
    expect(rangoFechasProyecto({ estado: 'ACTIVO', fechaPublicacion: '2026-11-13', horasRequeridas: 40 }))
      .toBe('13/11/2026 – 19/11/2026 (fin estimado)')
  })

  it('respeta fechas registradas y conserva la fecha real de fin', () => {
    expect(obtenerFechasProyecto({
      fechaInicio: '2026-11-17', fechaPublicacion: '2026-11-13', fechaFin: '2026-12-15', horasRequeridas: 40,
    })).toMatchObject({ inicio: '2026-11-17', fin: '2026-12-15', estimada: false })
  })

  it('no inventa fechas para borradores sin publicar ni para horas inválidas', () => {
    expect(obtenerFechasProyecto({ estado: 'BORRADOR', fechaCreacion: '2026-11-13', horasRequeridas: 40 }).inicio).toBeNull()
    expect(estimarFinProyecto('2026-11-13', 0)).toBeNull()
    expect(estimarFinProyecto('2026-02-30', 40)).toBeNull()
  })

  it('respeta el día local de El Salvador cerca de medianoche UTC', () => {
    expect(obtenerFechasProyecto({ estado: 'ACTIVO', fechaPublicacion: '2026-11-14T02:30:00.000Z', horasRequeridas: 8 }).inicio)
      .toBe('2026-11-13')
  })
})
