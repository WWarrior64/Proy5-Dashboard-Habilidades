import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Habilidades from '../pages/Habilidades.jsx'

vi.mock('../hooks/useOperationalPermissions.js', () => ({
  useOperationalPermissions: () => ({ canOperate: () => true, loading: false, operaciones: [] }),
}))
vi.mock('../components/layout/EmpleadoLogoutButton.jsx', () => ({
  default: () => null,
}))
import { colaboradoresService } from '../services/colaboradores.service.js'
import { habilidadesService } from '../services/habilidades.service.js'

vi.mock('../services/colaboradores.service.js', () => ({
  colaboradoresService: {
    getMe: vi.fn(), listSkills: vi.fn(), addSkill: vi.fn(),
    updateSkill: vi.fn(), removeSkill: vi.fn(),
  },
}))
vi.mock('../services/habilidades.service.js', () => ({
  habilidadesService: { listAll: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(colaboradoresService.getMe).mockResolvedValue({ data: { datos: { colaboradorId: 'col-1' } } })
  vi.mocked(colaboradoresService.listSkills).mockResolvedValue({
    data: { datos: { items: [{
      habilidadId: 'h-sql', nivel: 'MID', anosExperiencia: 6,
      observaciones: 'Administración de datos',
    }] } },
  })
  vi.mocked(habilidadesService.listAll).mockResolvedValue({
    data: { datos: { items: [
      { habilidadId: 'h-sql', nombre: 'SQL', categoria: 'BASES_DE_DATOS', estado: 'ACTIVO' },
      { habilidadId: 'h-aws', nombre: 'AWS Lambda', categoria: 'CLOUD', estado: 'ACTIVO' },
    ] } },
  })
  vi.mocked(colaboradoresService.addSkill).mockResolvedValue({ data: { success: true } })
})

describe('Habilidades del empleado vinculadas al catálogo de RRHH', () => {
  it('avisa temporalmente cuando la cuenta no tiene perfil, sin ocupar espacio en el contenido', async () => {
    vi.mocked(colaboradoresService.getMe).mockRejectedValue({
      response: { status: 404, data: { message: 'El usuario no tiene un perfil de colaborador' } },
    })
    render(<MemoryRouter><Habilidades /></MemoryRouter>)
    const aviso = await screen.findByText('El usuario no tiene un perfil de colaborador')
    expect(aviso.classList.contains('aviso-sin-perfil-colaborador')).toBe(true)
    expect(aviso.getAttribute('role')).toBe('status')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(colaboradoresService.listSkills).not.toHaveBeenCalled()
  })

  it('muestra categorías legibles, evita registros duplicados y asocia el ID seleccionado', async () => {
    vi.mocked(colaboradoresService.listSkills).mockResolvedValueOnce({
      data: { datos: { items: [
        { habilidadId: 'h-sql', nivel: 'MID', anosExperiencia: 6 },
        { habilidadId: 'h-js', nivel: 'JUNIOR', anosExperiencia: 1 },
      ] } },
    })
    vi.mocked(habilidadesService.listAll).mockResolvedValueOnce({
      data: { datos: { items: [
        { habilidadId: 'h-sql', nombre: 'SQL', categoria: 'BASES_DE_DATOS', estado: 'ACTIVO' },
        { habilidadId: 'h-js', nombre: 'JavaScript', categoria: 'CLOUD', estado: 'ACTIVO' },
        { habilidadId: 'h-aws', nombre: 'AWS Lambda', categoria: 'CLOUD', estado: 'ACTIVO' },
      ] } },
    })
    render(<MemoryRouter><Habilidades /></MemoryRouter>)
    expect(await screen.findByText('SQL')).toBeTruthy()
    expect(screen.getAllByText('Bases de datos').length).toBeGreaterThan(0)
    const filtroCategoria = screen.getByRole('combobox', { name: 'Filtrar por categoría' })
    const filtroNivel = screen.getByRole('combobox', { name: 'Filtrar por nivel' })
    expect(filtroCategoria.options[0].textContent).toBe('Todas')
    expect(filtroNivel.options[0].textContent).toBe('Todos')
    expect(filtroCategoria.closest('label').textContent).toContain('Categoría')
    expect(filtroNivel.closest('label').textContent).toContain('Nivel')
    fireEvent.change(filtroCategoria, { target: { value: 'CLOUD' } })
    expect(screen.queryByRole('button', { name: 'Editar SQL' })).toBeNull()
    fireEvent.change(filtroCategoria, { target: { value: '' } })
    fireEvent.change(filtroNivel, { target: { value: 'Senior' } })
    expect(screen.queryByRole('button', { name: 'Editar SQL' })).toBeNull()
    fireEvent.change(filtroNivel, { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Editar SQL' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Agregar habilidad' }))
    const selector = screen.getByRole('combobox', { name: 'Habilidad' })
    expect(selector.querySelector('option[value="h-sql"]')).toBeNull()
    expect(selector.querySelector('option[value="h-aws"]')).toBeTruthy()

    fireEvent.change(selector, { target: { value: 'h-aws' } })
    expect(screen.getByDisplayValue('Cloud')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(colaboradoresService.addSkill).toHaveBeenCalledWith(
      'col-1', { habilidadId: 'h-aws', nivel: 'JUNIOR', anosExperiencia: 0 },
    ))
  })

  it('no envía fechaUltimoUso al editar un registro anterior que no tenga fecha', async () => {
    vi.mocked(colaboradoresService.updateSkill).mockResolvedValue({ data: { success: true } })
    render(<MemoryRouter><Habilidades /></MemoryRouter>)
    expect(await screen.findByText('SQL')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Editar SQL' }))
    expect(screen.getByLabelText('Último uso (opcional)').value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(colaboradoresService.updateSkill).toHaveBeenCalledWith(
      'col-1', 'h-sql', expect.not.objectContaining({ fechaUltimoUso: null }),
    ))
  })

  it('muestra y actualiza la fecha de último uso registrada en la relación', async () => {
    vi.mocked(colaboradoresService.listSkills).mockResolvedValue({
      data: { datos: { items: [{
        habilidadId: 'h-sql', nivel: 'MID', anosExperiencia: 6,
        fechaUltimoUso: '2026-11-12', observaciones: 'Administración de datos',
      }] } },
    })
    vi.mocked(colaboradoresService.updateSkill).mockResolvedValue({ data: { success: true } })
    render(<MemoryRouter><Habilidades /></MemoryRouter>)
    expect(await screen.findByText('SQL')).toBeTruthy()
    expect(within(screen.getByRole('table')).getByText('12/11/2026')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Editar SQL' }))
    expect(screen.getByLabelText('Último uso (opcional)').value).toBe('2026-11-12')
    fireEvent.change(screen.getByLabelText('Último uso (opcional)'), { target: { value: '2026-11-14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(colaboradoresService.updateSkill).toHaveBeenCalledWith(
      'col-1', 'h-sql', expect.objectContaining({ fechaUltimoUso: '2026-11-14' }),
    ))
  })
})
