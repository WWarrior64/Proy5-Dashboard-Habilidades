import { describe, expect, it } from 'vitest'
import { esCandidatoAsignable } from '../utils/asignacionElegibilidad.js'

describe('Elegibilidad para asignaciones', () => {
  const proyecto = { proyectoId: 'p1', liderId: 'usuario-lider', estado: 'ACTIVO' }

  it('excluye al líder que también tiene un perfil de colaborador', () => {
    expect(esCandidatoAsignable({ colaboradorId: 'col-lider', usuarioId: 'usuario-lider' }, proyecto)).toBe(false)
  })

  it('permite colaboradores de otros usuarios', () => {
    expect(esCandidatoAsignable({ colaboradorId: 'col-otro', usuarioId: 'usuario-otro' }, proyecto)).toBe(true)
  })

  it('no asume identidades de registros reales incompletos', () => {
    expect(esCandidatoAsignable({ colaboradorId: 'sin-usuario' }, proyecto)).toBe(false)
    expect(esCandidatoAsignable({ usuarioId: 'usuario-otro' }, { proyectoId: 'sin-lider' })).toBe(false)
    expect(esCandidatoAsignable(null, proyecto)).toBe(false)
  })

  it('permite opciones marcadas expresamente como demostración', () => {
    expect(esCandidatoAsignable({ colaboradorId: 'demo', esEjemplo: true }, proyecto)).toBe(true)
  })
})
