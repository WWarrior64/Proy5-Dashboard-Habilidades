import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  canAccessRoute,
  getRolePermissions,
  hasAnyPermission,
  hasAllPermissions,
} from '../utils/permissions.js'
import { ROLES, PERMISSIONS } from '../utils/constants.js'

describe('Permissions', () => {
  describe('hasPermission', () => {
    it('EMPLEADO debe tener ver_perfil', () => {
      expect(hasPermission(ROLES.EMPLEADO, PERMISSIONS.VER_PERFIL)).toBe(true)
    })

    it('EMPLEADO no debe tener gestionar_usuarios', () => {
      expect(hasPermission(ROLES.EMPLEADO, PERMISSIONS.GESTIONAR_USUARIOS)).toBe(false)
    })

    it('ADMINISTRADOR debe tener gestionar_usuarios', () => {
      expect(hasPermission(ROLES.ADMINISTRADOR, PERMISSIONS.GESTIONAR_USUARIOS)).toBe(true)
    })

    it('RRHH debe tener registrar_colaborador', () => {
      expect(hasPermission(ROLES.RRHH, PERMISSIONS.REGISTRAR_COLABORADOR)).toBe(true)
    })

    it('LIDER_PROYECTO no debe tener gestionar_usuarios', () => {
      expect(hasPermission(ROLES.LIDER_PROYECTO, PERMISSIONS.GESTIONAR_USUARIOS)).toBe(false)
    })

    it('rol indefinido no debe tener permisos', () => {
      expect(hasPermission(undefined, PERMISSIONS.VER_PERFIL)).toBe(false)
    })

    it('permiso indefinido debe retornar false', () => {
      expect(hasPermission(ROLES.EMPLEADO, undefined)).toBe(false)
    })
  })

  describe('canAccessRoute', () => {
    it('EMPLEADO debe acceder a /perfil', () => {
      expect(canAccessRoute(ROLES.EMPLEADO, '/perfil')).toBe(true)
    })

    it('EMPLEADO no debe acceder a /usuarios', () => {
      expect(canAccessRoute(ROLES.EMPLEADO, '/usuarios')).toBe(false)
    })

    it('ADMINISTRADOR debe acceder a /usuarios', () => {
      expect(canAccessRoute(ROLES.ADMINISTRADOR, '/usuarios')).toBe(true)
    })

    it('RRHH debe acceder a /colaboradores', () => {
      expect(canAccessRoute(ROLES.RRHH, '/colaboradores')).toBe(true)
    })

    it('ruta sin permiso definido debe rechazarse', () => {
      expect(canAccessRoute(ROLES.EMPLEADO, '/ruta-inexistente')).toBe(false)
    })
  })

  describe('getRolePermissions', () => {
    it('EMPLEADO debe tener permisos específicos', () => {
      const perms = getRolePermissions(ROLES.EMPLEADO)
      expect(perms).toContain(PERMISSIONS.VER_PERFIL)
      expect(perms).toContain(PERMISSIONS.CONSULTAR_PROYECTOS)
    })

    it('ADMINISTRADOR debe tener más permisos que EMPLEADO', () => {
      const admin = getRolePermissions(ROLES.ADMINISTRADOR)
      const empleado = getRolePermissions(ROLES.EMPLEADO)
      expect(admin.length).toBeGreaterThan(empleado.length)
    })
  })

  describe('hasAnyPermission', () => {
    it('debe retornar true si tiene al menos uno', () => {
      expect(
        hasAnyPermission(ROLES.EMPLEADO, [PERMISSIONS.GESTIONAR_USUARIOS, PERMISSIONS.VER_PERFIL])
      ).toBe(true)
    })

    it('debe retornar false si no tiene ninguno', () => {
      expect(
        hasAnyPermission(ROLES.EMPLEADO, [PERMISSIONS.GESTIONAR_USUARIOS, PERMISSIONS.DAR_BAJA_COLABORADOR])
      ).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('debe retornar true si tiene todos', () => {
      expect(
        hasAllPermissions(ROLES.ADMINISTRADOR, [PERMISSIONS.VER_PERFIL, PERMISSIONS.GESTIONAR_USUARIOS])
      ).toBe(true)
    })

    it('debe retornar false si le falta alguno', () => {
      expect(
        hasAllPermissions(ROLES.EMPLEADO, [PERMISSIONS.VER_PERFIL, PERMISSIONS.GESTIONAR_USUARIOS])
      ).toBe(false)
    })
  })
})