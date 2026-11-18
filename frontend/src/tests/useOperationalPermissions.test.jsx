import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../hooks/useAuth.js', () => ({ useAuth: vi.fn() }))
vi.mock('../services/usuarios.service.js', () => ({
  usuariosService: { getMyPermissions: vi.fn() },
}))

import { useAuth } from '../hooks/useAuth.js'
import { usuariosService } from '../services/usuarios.service.js'
import { useOperationalPermissions } from '../hooks/useOperationalPermissions.js'

describe('Permisos operativos: no bloquear vistas por un fallo de API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { usuarioId: 'rrhh-1', rol: 'RRHH' } })
  })

  afterEach(() => cleanup())

  it('RRHH puede gestionar sus módulos mientras carga el endpoint', async () => {
    usuariosService.getMyPermissions.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useOperationalPermissions())
    for (const permiso of [
      'gestionar_colaboradores', 'gestionar_cargos', 'gestionar_habilidades',
      'gestionar_proyectos', 'gestionar_asignaciones',
    ]) {
      expect(result.current.canOperate(permiso)).toBe(true)
    }
    expect(result.current.canOperate('gestionar_usuarios')).toBe(false)
  })

  it('una ruta aún no desplegada no elimina los permisos históricos de RRHH', async () => {
    usuariosService.getMyPermissions.mockRejectedValue({ response: { status: 403 } })
    const { result } = renderHook(() => useOperationalPermissions())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.canOperate('gestionar_colaboradores')).toBe(true)
    expect(result.current.canOperate('gestionar_cargos')).toBe(true)
  })

  it('respeta restricciones cuando el backend devuelve una política válida', async () => {
    usuariosService.getMyPermissions.mockResolvedValue({
      data: { datos: { operaciones: ['gestionar_colaboradores'] } },
    })
    const { result } = renderHook(() => useOperationalPermissions())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.canOperate('gestionar_colaboradores')).toBe(true)
    expect(result.current.canOperate('gestionar_cargos')).toBe(false)
  })

  it('no permite obtener permisos ajenos al rol mediante una respuesta errónea', async () => {
    usuariosService.getMyPermissions.mockResolvedValue({
      data: { datos: { operaciones: ['gestionar_colaboradores', 'gestionar_usuarios'] } },
    })
    const { result } = renderHook(() => useOperationalPermissions())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.canOperate('gestionar_usuarios')).toBe(false)
  })
})
