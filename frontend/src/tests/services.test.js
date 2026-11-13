import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Services Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('debe exportar módulos de servicio principales', async () => {
    const auth = await import('../services/auth.service.js')
    expect(typeof auth.login).toBe('function')
    expect(typeof auth.logout).toBe('function')
    expect(typeof auth.isAuthenticated).toBe('function')

    const api = await import('../services/api.js')
    expect(api.api).toBeDefined()

    const cognito = await import('../services/cognito.service.js')
    expect(typeof cognito.signIn).toBe('function')

    const tokenRefresh = await import('../services/token-refresh.service.js')
    expect(typeof tokenRefresh.cleanup).toBe('function')
  })

  it('usa las rutas existentes para postulaciones por proyecto y colaborador', async () => {
    const api = (await import('../services/api.js')).default
    const obtener = vi.spyOn(api, 'get').mockResolvedValue({ data: { datos: [] } })
    const modificar = vi.spyOn(api, 'patch').mockResolvedValue({ data: { success: true } })
    const { postulacionesService } = await import('../services/postulaciones.service.js')

    await postulacionesService.listByCollaborator('col 1')
    await postulacionesService.listByProject('proy 1')
    await postulacionesService.decide('proy 1', 'col 1', { estado: 'ACEPTADA' })
    await postulacionesService.withdraw('proy 1', 'col 1')

    expect(obtener).toHaveBeenCalledWith('/colaboradores/col%201/postulaciones')
    expect(obtener).toHaveBeenCalledWith('/proyectos/proy%201/postulaciones')
    expect(modificar).toHaveBeenCalledWith('/proyectos/proy%201/postulaciones/col%201/estado', { estado: 'ACEPTADA' })
    expect(modificar).toHaveBeenCalledWith('/proyectos/proy%201/postulaciones/col%201/retirar', {})
  })

  it('consulta las asignaciones propias y las habilidades del perfil', async () => {
    const api = (await import('../services/api.js')).default
    const obtener = vi.spyOn(api, 'get').mockResolvedValue({ data: { datos: [] } })
    const { colaboradoresService } = await import('../services/colaboradores.service.js')
    const { asignacionesService } = await import('../services/asignaciones.service.js')

    await colaboradoresService.getMe()
    await asignacionesService.listByCollaborator('col-1')
    await asignacionesService.listByProject('proy-1')
    expect(obtener).toHaveBeenCalledWith('/colaboradores/yo')
    expect(obtener).toHaveBeenCalledWith('/colaboradores/col-1/asignaciones')
    expect(obtener).toHaveBeenCalledWith('/proyectos/proy-1/asignaciones')
  })
})