import { describe, it, expect } from 'vitest'
import { coincidenciaHabilidades, tieneAltaCoincidencia } from '../utils/coincidenciaHabilidades.js'

const requisito = (id, nivelMinimo = 'JUNIOR', peso = 1, esObligatoria = true) =>
  ({ habilidadId: id, nivelMinimo, peso, esObligatoria })
const skill = (id, nivel = 'JUNIOR') => ({ habilidadId: id, nivel })

describe('F02: coincidencia y filtros del empleado', () => {
  it('un proyecto sin requisitos no inventa porcentaje', () => {
    expect(coincidenciaHabilidades([], [skill('sql')]).porcentaje).toBe(null)
  })
  it('aplica niveles y ponderaciones', () => {
    const resultado = coincidenciaHabilidades([
      requisito('react', 'SENIOR', 3), requisito('sql', 'MID', 1),
    ], [skill('react', 'MID'), skill('sql', 'MID')])
    expect(resultado.porcentaje).toBe(0)
    expect(resultado.cumpleObligatorias).toBe(false)
    expect(tieneAltaCoincidencia(resultado)).toBe(false)
  })
  it('habilidades suficientes pueden alcanzar 100%', () => {
    const resultado = coincidenciaHabilidades([
      requisito('react', 'MID', 2), requisito('sql', 'MID', 1),
    ], [skill('react', 'SENIOR'), skill('sql', 'MID')])
    expect(resultado.porcentaje).toBe(100)
    expect(tieneAltaCoincidencia(resultado)).toBe(true)
  })
  it('sin coincidencias devuelve 0%', () => {
    expect(coincidenciaHabilidades([requisito('react')], [skill('sql')]).porcentaje).toBe(0)
  })
  it('el filtro de alta compatibilidad rechaza resultados sin requisitos obligatorios', () => {
    const resultado = coincidenciaHabilidades([
      requisito('react', 'SENIOR', 1), requisito('sql', 'JUNIOR', 4, false),
    ], [skill('sql', 'MID')])
    expect(resultado.porcentaje).toBe(0)
    expect(tieneAltaCoincidencia(resultado)).toBe(false)
  })
  it('si falló la consulta de requisitos no calcula porcentaje', () => {
    expect(coincidenciaHabilidades(null, [skill('react')]).porcentaje).toBe(null)
  })
})
