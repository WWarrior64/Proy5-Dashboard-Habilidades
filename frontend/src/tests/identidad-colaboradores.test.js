import { describe, expect, it } from 'vitest'
import { nombreColaborador, nombreLiderProyecto } from '../utils/formatters.js'

describe('Identidad de colaboradores en las vistas del Líder', () => {
  it('muestra el nombre real de la cuenta cuando el registro antiguo conserva un cargo como nombre', () => {
    expect(nombreColaborador({
      colaboradorId: 'colab_backend_002',
      nombre: 'Desarrollador Backend',
      nombreUsuario: 'Ana Martínez',
      rolProfesional: 'Desarrollador Backend',
    })).toBe('Ana Martínez')
  })

  it('identifica inequívocamente un registro antiguo sin nombre de cuenta disponible', () => {
    expect(nombreColaborador({
      colaboradorId: 'colab_backend_002',
      nombre: 'Desarrollador Backend',
      rolProfesional: 'Desarrollador Backend',
    })).toBe('Colaborador colab_backend_002')
  })

  it('mantiene el nombre personal cuando es distinto al cargo', () => {
    expect(nombreColaborador({
      colaboradorId: 'colab_backend_001',
      nombre: 'Carlos Méndez',
      rolProfesional: 'Desarrollador Backend',
    })).toBe('Carlos Méndez')
  })
})

describe('Nombre del líder compartido entre Proyectos y Postulaciones del Empleado', () => {
  it('utiliza el nombre público obtenido de la API de proyectos', () => {
    expect(nombreLiderProyecto({ liderId: 'lider-1', liderNombre: 'Diego Ernestos' }))
      .toBe('Diego Ernestos')
  })

  it('admite el nombre anidado cuando ya existe y distingue información no disponible', () => {
    expect(nombreLiderProyecto({ lider: { nombre: 'Diego Ernestos' } }))
      .toBe('Diego Ernestos')
    expect(nombreLiderProyecto({ liderId: 'lider-1' })).toBe('No registrado')
  })
})
