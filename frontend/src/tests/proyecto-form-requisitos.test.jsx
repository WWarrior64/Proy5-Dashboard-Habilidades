import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ProyectoForm from '../components/proyectos/ProyectoForm.jsx'

afterEach(cleanup)

describe('Formulario de proyectos de RRHH', () => {
  it('exige habilidades para publicar un proyecto activo y entrega niveles al controlador', () => {
    const guardar = vi.fn()
    render(<ProyectoForm
      proyecto={{
        nombre: 'Proyecto nuevo', descripcion: 'Integración de sistemas',
        liderId: 'lider-1', horasRequeridas: 20, estado: 'ACTIVO',
      }}
      lideres={[{ usuarioId: 'lider-1', nombre: 'Líder' }]}
      habilidades={[{ habilidadId: 'hab-1', nombre: 'JavaScript', estado: 'ACTIVO' }]}
      onSave={guardar}
      onCancel={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText(/Selecciona al menos una habilidad antes de publicar/)).toBeTruthy()
    expect(guardar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Añadir habilidad$/ }))
    fireEvent.change(screen.getByLabelText('Nivel mínimo 1'), { target: { value: 'SENIOR' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'ACTIVO', requisitos: [{ habilidadId: 'hab-1', nivelMinimo: 'SENIOR' }],
    }))
  })
})
