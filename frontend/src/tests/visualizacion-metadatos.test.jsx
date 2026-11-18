import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ActivityList from '../components/dashboard/ActivityList.jsx'
import { etiquetaCodigo, etiquetaRol } from '../utils/formatters.js'

describe('Presentación de datos técnicos', () => {
  it('convierte categorías y roles a etiquetas legibles sin cambiar sus identificadores', () => {
    expect(etiquetaCodigo('BASES_DE_DATOS')).toBe('Bases de datos')
    expect(etiquetaCodigo('AWS')).toBe('AWS')
    expect(etiquetaRol('LIDER_PROYECTO')).toBe('Líder de proyecto')
    expect(etiquetaRol('RRHH')).toBe('RRHH')
    expect(etiquetaRol('ADMINISTRADOR')).toBe('Administrador')
  })

  it('presenta eventos reales en palabras y en fecha local salvadoreña', () => {
    render(<ActivityList activities={[{
      id: 'a1', tipo: 'asignacion', estado: 'DESVINCULADA',
      nombre: 'Modernización de plataforma Cloud', fecha: '2026-11-13T20:05:53.440Z',
    }]} />)
    expect(screen.getByText('Colaborador desvinculado')).toBeTruthy()
    expect(screen.getByText('Desvinculada')).toBeTruthy()
    expect(screen.getByText('Modernización de plataforma Cloud')).toBeTruthy()
    expect(screen.getByText(/13\/11\/2026/)).toBeTruthy()
  })

  it('identifica proyectos registrados sin inventar una fecha de cancelación', () => {
    render(<ActivityList activities={[{
      id: 'p1', tipo: 'proyecto', estado: 'CANCELADO',
      nombre: 'Proyecto histórico', fecha: '2026-11-07T12:00:00.000Z',
    }]} />)
    expect(screen.getByText('Proyecto registrado')).toBeTruthy()
    expect(screen.getByText('Cancelado')).toBeTruthy()
  })
})
