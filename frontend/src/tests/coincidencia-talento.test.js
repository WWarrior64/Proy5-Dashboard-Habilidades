import { describe, expect, it } from 'vitest'
import { evaluarCoincidenciaVisible } from '../utils/coincidenciaTalento.js'

describe('Coincidencia visible de colaboradores en Buscar talento', () => {
  const requisitos = [
    { habilidadId: 'sql', nombre: 'SQL', nivelMinimo: 'MID', peso: 2, esObligatoria: true },
    { habilidadId: 'js', nombre: 'JavaScript', nivelMinimo: 'JUNIOR', peso: 1, esObligatoria: false },
  ]

  it('calcula la coincidencia ponderada cuando se cumplen los requisitos obligatorios', () => {
    const resultado = evaluarCoincidenciaVisible([
      { habilidadId: 'sql', nombre: 'SQL', nivel: 'SENIOR' },
    ], requisitos)
    expect(resultado.puntuacion).toBe(67)
    expect(resultado.coincidentes).toEqual(['SQL'])
    expect(resultado.faltantes).toEqual(['JavaScript'])
    expect(resultado.cumpleObligatorias).toBe(true)
  })

  it('conserva el porcentaje parcial aunque falte una habilidad obligatoria', () => {
    const resultado = evaluarCoincidenciaVisible([
      { habilidadId: 'sql', nivel: 'JUNIOR' },
      { habilidadId: 'js', nombre: 'JavaScript', nivel: 'MID' },
    ], requisitos)
    expect(resultado.puntuacion).toBe(33)
    expect(resultado.cumpleObligatorias).toBe(false)
    expect(resultado.faltantes).toContain('SQL')
  })

  it('muestra 50 % cuando coincide una de dos habilidades obligatorias', () => {
    const resultado = evaluarCoincidenciaVisible(
      [{ habilidadId: 'sql', nombre: 'SQL', nivel: 'MID' }],
      [{ habilidadId: 'sql', nombre: 'SQL', nivelMinimo: 'MID', esObligatoria: true },
        { habilidadId: 'js', nombre: 'JavaScript', nivelMinimo: 'JUNIOR', esObligatoria: true }],
    )
    expect(resultado.puntuacion).toBe(50)
    expect(resultado.coincidentes).toEqual(['SQL'])
    expect(resultado.faltantes).toEqual(['JavaScript'])
    expect(resultado.cumpleObligatorias).toBe(false)
  })

  it('reconoce habilidades de ejemplo por su nombre si no poseen identificador', () => {
    expect(evaluarCoincidenciaVisible(
      [{ nombre: 'SQL', nivel: 'MID' }],
      [{ nombre: 'sql', nivelMinimo: 'JUNIOR' }],
    ).puntuacion).toBe(100)
  })

  it('no inventa porcentajes si no existen requisitos o no se pudieron cargar las habilidades', () => {
    expect(evaluarCoincidenciaVisible([], [])).toBeNull()
    expect(evaluarCoincidenciaVisible(undefined, requisitos)).toBeNull()
  })
})
