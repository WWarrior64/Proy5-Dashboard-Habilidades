import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RrhhColaboradoresVista from '../pages/RrhhColaboradoresVista.jsx'
import { useAuth } from '../hooks/useAuth.js'

vi.mock('../hooks/useAuth.js', () => ({ useAuth: vi.fn() }))
vi.mock('../components/layout/EmpleadoLogoutButton.jsx', () => ({ default: () => null }))

afterEach(cleanup)

describe('RRHH: colaboradores activos y reincorporaciones', () => {
  it('oculta los dados de baja hasta seleccionarlos y ofrece reincorporarlos', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { rol: 'RRHH' } })
    const reincorporar = vi.fn()
    const colaboradores = [
      { colaboradorId: 'c1', usuarioId: 'u1', nombre: 'Ana Activa', estado: 'ACTIVO', habilidades: ['React'], dedicacionReservada: 0 },
      { colaboradorId: 'c2', usuarioId: 'u2', nombre: 'Luis Inactivo', estado: 'INACTIVO', habilidades: ['SQL'], dedicacionReservada: 0 },
    ]
    render(<MemoryRouter><RrhhColaboradoresVista
      colaboradores={colaboradores} usuarios={[
        { usuarioId: 'u1', nombre: 'Ana Activa', estado: 'ACTIVO' },
        { usuarioId: 'u2', nombre: 'Luis Inactivo', estado: 'ACTIVO' },
      ]} cargos={[]} loading={false} error=""
      canManage onCreate={vi.fn()} onEdit={vi.fn()} onRemove={vi.fn()}
      onReincorporate={reincorporar} onDetails={vi.fn()} onRetry={vi.fn()}
    /></MemoryRouter>)
    expect(screen.getByText('Ana Activa')).toBeTruthy()
    expect(screen.queryByText('Luis Inactivo')).toBeNull()
    fireEvent.change(screen.getByLabelText('Filtrar colaboradores por estado'), { target: { value: 'INACTIVO' } })
    expect(screen.getByText('Luis Inactivo')).toBeTruthy()
    expect(screen.queryByText('Ana Activa')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reincorporar Luis Inactivo' }))
    expect(reincorporar).toHaveBeenCalledWith(expect.objectContaining({ colaboradorId: 'c2', estado: 'INACTIVO' }))
    const eliminar = screen.getByRole('button', { name: 'Eliminar definitivamente colaborador Luis Inactivo' })
    expect(eliminar.disabled).toBe(false)
  })

  it('filtra la plantilla por el rol profesional real, sin confundirlo con niveles de habilidad', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { rol: 'RRHH' } })
    const colaboradores = [
      { colaboradorId: 'c1', usuarioId: 'u1', nombre: 'Ana Backend', rolProfesional: 'Desarrollador Backend', estado: 'ACTIVO', dedicacionReservada: 0, habilidades: [] },
      { colaboradorId: 'c2', usuarioId: 'u2', nombre: 'Luis Frontend', rolProfesional: 'Desarrollador Frontend', estado: 'ACTIVO', dedicacionReservada: 0, habilidades: [] },
    ]
    render(<MemoryRouter><RrhhColaboradoresVista
      colaboradores={colaboradores}
      usuarios={[
        { usuarioId: 'u1', nombre: 'Ana Backend', estado: 'ACTIVO' },
        { usuarioId: 'u2', nombre: 'Luis Frontend', estado: 'ACTIVO' },
      ]}
      cargos={[]} loading={false} error="" canManage
      onCreate={vi.fn()} onEdit={vi.fn()} onRemove={vi.fn()}
      onReincorporate={vi.fn()} onDetails={vi.fn()} onRetry={vi.fn()}
    /></MemoryRouter>)
    const filtro = screen.getByRole('combobox', { name: 'Filtrar por rol profesional' })
    expect(screen.getByText('Ana Backend')).toBeTruthy()
    expect(screen.getByText('Luis Frontend')).toBeTruthy()
    expect([...document.querySelectorAll('.rrhh-colaborador-identity p')]
      .some(elemento => elemento.textContent.includes('Desarrollador Backend'))).toBe(true)
    fireEvent.change(filtro, { target: { value: 'Desarrollador Backend' } })
    expect(screen.getByText('Ana Backend')).toBeTruthy()
    expect(screen.queryByText('Luis Frontend')).toBeNull()
  })

  it('filtra por cargo y muestra disponibilidad fuera del desplegable', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { rol: 'RRHH' } })
    render(<MemoryRouter><RrhhColaboradoresVista
      colaboradores={[
        { colaboradorId: 'c1', usuarioId: 'u1', nombre: 'Ana Backend', rolProfesional: 'Desarrolladora Backend', cargoId: 'backend', estado: 'ACTIVO', dedicacionReservada: 0 },
        { colaboradorId: 'c2', usuarioId: 'u2', nombre: 'Luis Datos', cargoId: 'datos', estado: 'ACTIVO', dedicacionReservada: 0 },
      ]}
      usuarios={[
        { usuarioId: 'u1', nombre: 'Ana Backend', estado: 'ACTIVO' },
        { usuarioId: 'u2', nombre: 'Luis Datos', estado: 'ACTIVO' },
      ]}
      cargos={[{ cargoId: 'backend', nombre: 'Backend' }, { cargoId: 'datos', nombre: 'Datos' }]}
      loading={false} error="" canManage
      onCreate={vi.fn()} onEdit={vi.fn()} onRemove={vi.fn()}
      onReincorporate={vi.fn()} onDetails={vi.fn()} onRetry={vi.fn()}
    /></MemoryRouter>)
    expect(screen.getByText('Cargo: Backend')).toBeTruthy()
    expect(screen.getByText('Cargo: Datos')).toBeTruthy()
    expect([...document.querySelectorAll('.rrhh-colaborador-identity p')]
      .some(elemento => elemento.textContent.includes('Desarrolladora Backend'))).toBe(true)
    const cargo = screen.getByRole('combobox', { name: 'Filtrar por cargo' })
    expect(cargo.querySelector('option[value="backend"]')).toBeTruthy()
    const disponibilidad = screen.getByRole('combobox', { name: 'Filtrar por disponibilidad' })
    expect(disponibilidad.options[0].textContent).toBe('Todas')
    expect(screen.getByText('Disponibilidad')).toBeTruthy()
    fireEvent.change(cargo, { target: { value: 'backend' } })
    expect(screen.getByText('Ana Backend')).toBeTruthy()
    expect(screen.queryByText('Luis Datos')).toBeNull()
  })
})
