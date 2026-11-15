import { describe, expect, it } from 'vitest'
import { esCandidatoAsignable, evaluarAsignacion } from '../utils/asignacionElegibilidad.js'

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

  const persona = {
    colaboradorId: 'c1', usuarioId: 'usuario-otro',
    estado: 'ACTIVO', dedicacionReservada: 20,
  }
  const requisitos = [{ habilidadId: 'react', nivelMinimo: 'MID', esObligatoria: true }]
  const habilidades = [{ habilidadId: 'react', nivel: 'SENIOR' }]
  const evaluar = cambios => evaluarAsignacion({
    colaborador: persona, proyecto, requisitos, habilidades, porcentaje: 30,
    asignaciones: [], ...cambios,
  })

  it('permite una asignación válida con reserva disponible', () => {
    expect(evaluar({}).elegible).toBe(true)
    expect(evaluar({}).libre).toBe(80)
  })
  it('excluye colaboradores y usuarios inactivos', () => {
    expect(evaluar({ colaborador: { ...persona, estado: 'INACTIVO' } }).elegible).toBe(false)
    expect(evaluar({ usuario: { estado: 'INACTIVO' } }).elegible).toBe(false)
  })
  it('rechaza al líder de su propio proyecto', () => {
    expect(evaluar({ colaborador: { ...persona, usuarioId: 'usuario-lider' } }).elegible).toBe(false)
  })
  it('impide duplicar al colaborador incluso si su asignación es histórica', () => {
    expect(evaluar({ asignaciones: [
      { proyectoId: 'p1', colaboradorId: 'c1', estado: 'FINALIZADA' },
    ] }).elegible).toBe(false)
  })
  it('no permite superar el 100 % acumulado de dedicación', () => {
    expect(evaluar({ colaborador: { ...persona, dedicacionReservada: 80 } }).elegible).toBe(false)
    expect(evaluar({ colaborador: { ...persona, dedicacionReservada: 70 } }).elegible).toBe(true)
  })
  it('comprueba las habilidades obligatorias y sus niveles', () => {
    expect(evaluar({ habilidades: [{ habilidadId: 'react', nivel: 'JUNIOR' }] }).elegible).toBe(false)
    expect(evaluar({ habilidades: [] }).elegible).toBe(false)
    expect(evaluar({}).elegible).toBe(true)
  })
  it('no confunde asignaciones finalizadas ajenas con dedicación activa', () => {
    expect(evaluar({ colaborador: { ...persona, dedicacionReservada: 0 },
      asignaciones: [{ proyectoId: 'otra', colaboradorId: 'c1', estado: 'FINALIZADA' }] }).elegible).toBe(true)
  })
  it('no declara disponible a un colaborador sin reserva verificable', () => {
    expect(evaluar({ colaborador: { ...persona, dedicacionReservada: undefined } }).elegible).toBe(false)
  })
})
