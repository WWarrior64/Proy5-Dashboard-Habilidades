import { describe, expect, it } from 'vitest'
import { disponibilidadCalculada, porcentajeLibre } from '../utils/disponibilidad.js'

describe('Disponibilidad calculada desde la dedicación persistida', () => {
  it('no utiliza el estado estático que pudo haberse guardado al dar de alta', () => {
    const colaborador = { estado: 'ACTIVO', disponibilidad: 'DISPONIBLE', dedicacionReservada: 50 }
    expect(disponibilidadCalculada(colaborador)).toBe('PARCIAL')
    expect(porcentajeLibre(colaborador)).toBe(50)
  })

  it('reconoce disponibilidad completa, ninguna y datos históricos incompletos', () => {
    expect(disponibilidadCalculada({ estado: 'ACTIVO', dedicacionReservada: 0 })).toBe('DISPONIBLE')
    expect(disponibilidadCalculada({ estado: 'ACTIVO', dedicacionReservada: 100 })).toBe('NO_DISPONIBLE')
    expect(disponibilidadCalculada({ estado: 'ACTIVO' })).toBe('SIN_DATOS')
    expect(porcentajeLibre({ estado: 'ACTIVO' })).toBeNull()
    expect(disponibilidadCalculada({ estado: 'INACTIVO', dedicacionReservada: 0 })).toBe('NO_DISPONIBLE')
  })
})
