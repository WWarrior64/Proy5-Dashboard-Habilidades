import { describe, expect, it } from 'vitest'
import { PERMISOS_OFICIALES, ROLES_OFICIALES, resolverPoliticaAdministrativa } from '../utils/administracionPermisos.js'

describe('Catálogo de roles y permisos en Administración', () => {
  it('muestra los ocho permisos y los cuatro roles cuando la API no está disponible', () => {
    const politica = resolverPoliticaAdministrativa(null)
    expect(politica.compatible).toBe(false)
    expect(politica.roles).toHaveLength(4)
    expect(politica.permisos).toHaveLength(8)
    expect(politica.permisos.find(item => item.id === 'gestionar_colaboradores').roles)
      .toContain('RRHH')
    expect(politica.permisos.find(item => item.id === 'gestionar_usuarios').roles)
      .not.toContain('RRHH')
  })

  it('no toma los dos permisos de una configuración administrativa antigua como únicos permisos', () => {
    const antigua = {
      version: 1,
      roles: ROLES_OFICIALES,
      permisos: [
        { id: 'colaboradores', nombre: 'Gestionar colaboradores', roles: [] },
        { id: 'postulaciones', nombre: 'Revisar postulaciones', roles: ['EMPLEADO'] },
      ],
    }
    const politica = resolverPoliticaAdministrativa(antigua)
    expect(politica.compatible).toBe(false)
    expect(politica.permisos.map(item => item.id))
      .toEqual(PERMISOS_OFICIALES.map(item => item.id))
  })

  it('respeta cambios de permisos cuando el backend devuelve el catálogo completo', () => {
    const inicial = resolverPoliticaAdministrativa(null)
    const completa = { version: 2, roles: inicial.roles, permisos: inicial.permisos.map(item => ({
      ...item,
      roles: item.id === 'gestionar_asignaciones' ? ['LIDER_PROYECTO', 'ADMINISTRADOR'] : item.roles,
    })) }
    const politica = resolverPoliticaAdministrativa(completa)
    expect(politica.compatible).toBe(true)
    expect(politica.permisos.find(item => item.id === 'gestionar_asignaciones').roles)
      .not.toContain('RRHH')
    expect(politica.permisos.find(item => item.id === 'gestionar_cargos').roles)
      .toContain('RRHH')
  })

  it('rechaza respuestas incompletas o con permisos concedidos fuera del rol', () => {
    const inicial = resolverPoliticaAdministrativa(null)
    const escalada = { version: 2, roles: inicial.roles, permisos: inicial.permisos.map(item => ({
      ...item, roles: item.id === 'gestionar_colaboradores' ? [...item.roles, 'EMPLEADO'] : item.roles,
    })) }
    expect(resolverPoliticaAdministrativa(escalada).compatible).toBe(false)
    expect(resolverPoliticaAdministrativa({ ...escalada, permisos: escalada.permisos.slice(0, 2) }).compatible)
      .toBe(false)
  })
})
