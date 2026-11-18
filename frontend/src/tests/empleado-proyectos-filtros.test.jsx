import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmpleadoProyectos from '../pages/EmpleadoProyectos.jsx'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { proyectosService } from '../services/proyectos.service.js'
import { habilidadesService } from '../services/habilidades.service.js'
import { postulacionesService } from '../services/postulaciones.service.js'

vi.mock('../components/common/BrandName.jsx', () => ({ default: () => 'Internal Marketplace' }))
vi.mock('../components/layout/EmpleadoLogoutButton.jsx', () => ({ default: () => null }))
vi.mock('../hooks/useOperationalPermissions.js', () => ({
  useOperationalPermissions: () => ({ canOperate: () => true }),
}))
vi.mock('../services/colaboradores.service.js', () => ({
  colaboradoresService: { getMe: vi.fn(), listSkills: vi.fn() },
}))
vi.mock('../services/proyectos.service.js', () => ({
  proyectosService: { list: vi.fn() },
}))
vi.mock('../services/habilidades.service.js', () => ({
  habilidadesService: { listAll: vi.fn() },
}))
vi.mock('../services/postulaciones.service.js', () => ({
  postulacionesService: { listByCollaborator: vi.fn(), create: vi.fn() },
}))
vi.mock('../services/api.js', () => ({ default: { get: vi.fn() } }))

describe('Filtros estandarizados de proyectos disponibles del empleado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    colaboradoresService.getMe.mockResolvedValue({ data: { datos: { colaboradorId: 'c1' } } })
    colaboradoresService.listSkills.mockResolvedValue({ data: { datos: { items: [] } } })
    proyectosService.list.mockResolvedValue({ data: { datos: { items: [] } } })
    habilidadesService.listAll.mockResolvedValue({ data: { datos: { items: [] } } })
    postulacionesService.listByCollaborator.mockResolvedValue({ data: { datos: { items: [] } } })
  })
  afterEach(cleanup)

  it('ofrece Todas y Alta coincidencia sin depender del antiguo botón de embudo', async () => {
    render(<MemoryRouter><EmpleadoProyectos /></MemoryRouter>)
    const filtro = screen.getByRole('combobox', { name: 'Filtrar proyectos por coincidencia' })
    expect(filtro.closest('label').textContent).toContain('Coincidencia')
    expect([...filtro.options].map(opcion => opcion.textContent)).toEqual(['Todas', 'Alta coincidencia'])
    expect(filtro.value).toBe('TODAS')
    fireEvent.change(filtro, { target: { value: 'ALTA' } })
    expect(filtro.value).toBe('ALTA')
    fireEvent.change(filtro, { target: { value: 'TODAS' } })
    expect(filtro.value).toBe('TODAS')
    await waitFor(() => expect(screen.queryByText('Consultando proyectos...')).toBeNull())
  })
})
