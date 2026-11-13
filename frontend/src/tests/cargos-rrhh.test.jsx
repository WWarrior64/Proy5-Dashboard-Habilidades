import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import GestionCargosModal from '../components/cargos/GestionCargosModal.jsx'
import { cargosService } from '../services/cargos.service.js'

vi.mock('../services/cargos.service.js', () => ({
  cargosService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    changeStatus: vi.fn(),
  },
}))

const cargoActivo = {
  cargoId: 'cargo-1', nombre: 'Analista de sistemas',
  categoria: 'TECNOLOGIA', descripcion: 'Análisis funcional', estado: 'ACTIVO',
}

describe('Gestión de Cargos de RRHH', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(cargosService.list).mockResolvedValue({
      data: { datos: { items: [cargoActivo], lastKey: null } },
    })
    vi.mocked(cargosService.create).mockResolvedValue({ data: { success: true } })
    vi.mocked(cargosService.update).mockResolvedValue({ data: { success: true } })
    vi.mocked(cargosService.changeStatus).mockResolvedValue({ data: { success: true } })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('consulta cargos reales y registra uno nuevo mediante la API', async () => {
    const actualizado = vi.fn()
    render(<GestionCargosModal abierto onClose={vi.fn()} onUpdated={actualizado} />)
    expect(await screen.findByText('Analista de sistemas')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cargo' }))
    fireEvent.change(screen.getByLabelText('Nombre del cargo'), {
      target: { value: 'Ingeniero de pruebas' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'tecnologia' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cargo' }))

    await waitFor(() => expect(cargosService.create).toHaveBeenCalledWith({
      nombre: 'Ingeniero de pruebas', descripcion: '', categoria: 'TECNOLOGIA',
    }))
    await waitFor(() => expect(actualizado).toHaveBeenCalled())
  })

  it('confirma la desactivación dentro del modal antes de llamar a la API', async () => {
    render(<GestionCargosModal abierto onClose={vi.fn()} />)
    await screen.findByText('Analista de sistemas')
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    expect(screen.getByText('Confirmar cambio de estado')).toBeTruthy()
    expect(cargosService.changeStatus).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }))
    await waitFor(() => expect(cargosService.changeStatus).toHaveBeenCalledWith(
      'cargo-1', { activo: false },
    ))
  })

  it('oculta los cargos desactivados hasta que RRHH selecciona el filtro', async () => {
    const desactivado = { cargoId: 'cargo-2', nombre: 'Cargo histórico', categoria: 'GENERAL', estado: 'INACTIVO' }
    vi.mocked(cargosService.list).mockResolvedValue({
      data: { datos: { items: [cargoActivo, desactivado], lastKey: null } },
    })
    render(<GestionCargosModal abierto onClose={vi.fn()} />)
    await screen.findByText('Analista de sistemas')
    expect(screen.queryByText('Cargo histórico')).toBeNull()
    fireEvent.change(screen.getByLabelText('Filtrar cargos por estado'), { target: { value: 'INACTIVO' } })
    expect(await screen.findByText('Cargo histórico')).toBeTruthy()
    expect(screen.queryByText('Analista de sistemas')).toBeNull()
    fireEvent.change(screen.getByLabelText('Filtrar cargos por estado'), { target: { value: 'TODOS' } })
    expect(screen.getByText('Analista de sistemas')).toBeTruthy()
    expect(screen.getByText('Cargo histórico')).toBeTruthy()
  })

  it('no presenta los formularios si el catálogo falla al cargar', async () => {
    vi.mocked(cargosService.list).mockRejectedValue(new Error('API no disponible'))
    render(<GestionCargosModal abierto onClose={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'API no disponible')
  })
})
