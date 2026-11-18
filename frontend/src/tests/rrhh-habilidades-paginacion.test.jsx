import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../components/common/BrandName.jsx', () => ({ default: () => 'Internal Marketplace' }))
vi.mock('../components/layout/EmpleadoLogoutButton.jsx', () => ({ default: () => null }))
vi.mock('../hooks/useOperationalPermissions.js', () => ({
  useOperationalPermissions: () => ({ canOperate: () => true }),
}))
vi.mock('../services/habilidades.service.js', () => ({
  habilidadesService: { listAll: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
vi.mock('../services/colaboradores.service.js', () => ({
  colaboradoresService: { listAll: vi.fn(), listSkills: vi.fn() },
}))
vi.mock('../services/api.js', () => ({ default: { get: vi.fn() } }))

import RrhhHabilidadesVista from '../pages/RrhhHabilidadesVista.jsx'
import { habilidadesService } from '../services/habilidades.service.js'
import { colaboradoresService } from '../services/colaboradores.service.js'
import api from '../services/api.js'

describe('RRHH: paginación del catálogo de habilidades', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    habilidadesService.listAll.mockResolvedValue({
      data: { datos: { items: Array.from({ length: 30 }, (_, indice) => ({
        habilidadId: 'h' + (indice + 1),
        nombre: 'Habilidad ' + (indice + 1),
        categoria: 'BACKEND',
        descripcion: 'Descripción ' + (indice + 1),
        estado: 'ACTIVO',
      })) } },
    })
    colaboradoresService.listAll.mockResolvedValue({ data: { datos: { items: [] } } })
    api.get.mockResolvedValue({ data: { datos: { distribucion: [] } } })
  })
  afterEach(cleanup)

  it('muestra 10 habilidades por página, avanza y reinicia con los filtros', async () => {
    render(<MemoryRouter><RrhhHabilidadesVista /></MemoryRouter>)
    expect(await screen.findByText('Habilidad 1')).toBeTruthy()
    const categoria = screen.getByRole('combobox', { name: 'Filtrar por categoría' })
    expect(categoria.options[0].textContent).toBe('Todas')
    expect(categoria.closest('label').textContent).toContain('Categoría')
    await waitFor(() => expect(screen.getByText('Página 1 de 3')).toBeTruthy())
    expect(screen.getAllByRole('row')).toHaveLength(11)
    expect(screen.queryByText('Habilidad 11')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Habilidad 11')).toBeTruthy()
    expect(screen.queryByText('Habilidad 1')).toBeNull()
    expect(screen.getByText('Página 2 de 3')).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(11)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Página 3 de 3')).toBeTruthy()
    expect(document.querySelector('.rrhh-habilidades-count').textContent.replace(/\s+/g, ' '))
      .toContain('Mostrando 21–30 de 30 habilidades')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por habilidad, categoría o descripción' }),
      { target: { value: 'Habilidad 30' } })
    await waitFor(() => expect(screen.getByText('Habilidad 30')).toBeTruthy())
    await waitFor(() => expect(screen.queryByText('Página 2 de 3')).toBeNull())
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })
})
