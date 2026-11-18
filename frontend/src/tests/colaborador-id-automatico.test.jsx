import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ColaboradorForm from '../components/colaboradores/ColaboradorForm.jsx'

afterEach(cleanup)

describe('Registro de colaboradores por cuenta única', () => {
  it('no solicita el ID, lo deja al backend y envía la cuenta seleccionada', () => {
    const guardar = vi.fn()
    const { container } = render(<ColaboradorForm
      usuarios={[{ usuarioId: 'usuario-1', nombre: 'Colaborador disponible' }]}
      cargos={[{ cargoId: 'cargo-1', nombre: 'Desarrollador' }]}
      onSave={guardar} onCancel={vi.fn()}
    />)

    expect(screen.queryByText(/ID de Colaborador/i)).toBeNull()
    expect(screen.getByText(/identificador se genera automáticamente/i)).toBeTruthy()

    const [usuarios, cargos] = screen.getAllByRole('combobox')
    fireEvent.change(usuarios, { target: { value: 'usuario-1' } })
    fireEvent.change(cargos, { target: { value: 'cargo-1' } })
    fireEvent.change(container.querySelector('input[type="text"]'), {
      target: { value: 'Desarrollador Backend' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 'usuario-1', cargoId: 'cargo-1', rolProfesional: 'Desarrollador Backend',
    }))
    expect(guardar.mock.calls[0][0]).not.toHaveProperty('colaboradorId')
  })

  it('no ofrece cuentas de RRHH ni Administrador al registrar un colaborador', () => {
    render(<ColaboradorForm
      usuarios={[
        { usuarioId: 'u-empleado', nombre: 'Empleado', rol: 'EMPLEADO' },
        { usuarioId: 'u-lider', nombre: 'Líder', rol: 'LIDER_PROYECTO' },
        { usuarioId: 'u-rrhh', nombre: 'Recursos Humanos', rol: 'RRHH' },
        { usuarioId: 'u-admin', nombre: 'Administrador', rol: 'ADMINISTRADOR' },
      ]}
      cargos={[{ cargoId: 'cargo-1', nombre: 'Desarrollador' }]}
      onSave={vi.fn()} onCancel={vi.fn()}
    />)
    const selector = screen.getAllByRole('combobox')[0]
    expect([...selector.options].map(opcion => opcion.value))
      .toEqual(['', 'u-empleado', 'u-lider'])
    expect(screen.queryByRole('option', { name: 'Recursos Humanos' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Administrador' })).toBeNull()
  })

  it('mantiene la cuenta vinculada bloqueada durante la edición', () => {
    render(<ColaboradorForm
      colaborador={{ colaboradorId: 'c1', usuarioId: 'u1', cargoId: 'cargo-1', rolProfesional: 'Backend' }}
      usuarios={[{ usuarioId: 'u1', nombre: 'Usuario histórico' }]}
      cargos={[{ cargoId: 'cargo-1', nombre: 'Backend' }]}
      onSave={vi.fn()} onCancel={vi.fn()}
    />)
    expect(screen.getAllByRole('combobox')[0].disabled).toBe(true)
    expect(screen.queryByText(/ID de Colaborador/i)).toBeNull()
  })
})
