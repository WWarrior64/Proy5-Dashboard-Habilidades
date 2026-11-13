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
      { colaboradorId: 'c1', nombre: 'Ana Activa', estado: 'ACTIVO', habilidades: ['React'], dedicacionReservada: 0 },
      { colaboradorId: 'c2', nombre: 'Luis Inactivo', estado: 'INACTIVO', habilidades: ['SQL'], dedicacionReservada: 0 },
    ]
    render(<MemoryRouter><RrhhColaboradoresVista
      colaboradores={colaboradores} usuarios={[]} cargos={[]} loading={false} error=""
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
  })
})
