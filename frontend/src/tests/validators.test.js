import { describe, it, expect } from 'vitest'
import {
  validators,
  validateForm,
  isValidEmail,
  isPositiveNumber,
  isValidPercentage,
  isValidSkillLevel,
  isValidRole,
} from '../utils/validators.js'

describe('Validators', () => {
  describe('validators.required', () => {
    it('debe fallar con valor vacío', () => {
      expect(validators.required('')).toBe('Este campo es obligatorio')
    })

    it('debe fallar con null', () => {
      expect(validators.required(null)).toBe('Este campo es obligatorio')
    })

    it('debe pasar con valor válido', () => {
      expect(validators.required('texto')).toBeUndefined()
    })
  })

  describe('validators.email', () => {
    it('debe aceptar correo válido', () => {
      expect(validators.email('usuario@empresa.com')).toBeUndefined()
    })

    it('debe rechazar correo inválido', () => {
      expect(validators.email('correo-invalido')).toBe('Correo inválido')
    })

    it('debe pasar con valor vacío', () => {
      expect(validators.email('')).toBeUndefined()
    })
  })

  describe('validators.phone', () => {
    it('acepta números, espacios, guiones, signo más y paréntesis', () => {
      expect(validators.phone('+503 (2211)-2233')).toBeUndefined()
      expect(validators.phone('')).toBeUndefined()
    })

    it('rechaza caracteres no permitidos', () => {
      expect(validators.phone('1234abc')).toBe('Teléfono inválido')
    })
  })

  describe('validators.percentage', () => {
    it('debe aceptar 0', () => {
      expect(validators.percentage(0)).toBeUndefined()
    })

    it('debe aceptar 100', () => {
      expect(validators.percentage(100)).toBeUndefined()
    })

    it('debe rechazar valor fuera de rango', () => {
      expect(validators.percentage(101)).toBe('Debe estar entre 0 y 100')
      expect(validators.percentage(-1)).toBe('Debe estar entre 0 y 100')
    })
  })

  describe('validators.skillLevel', () => {
    it('debe aceptar JUNIOR, MID, SENIOR', () => {
      expect(validators.skillLevel('JUNIOR')).toBeUndefined()
      expect(validators.skillLevel('MID')).toBeUndefined()
      expect(validators.skillLevel('SENIOR')).toBeUndefined()
    })

    it('debe rechazar nivel inválido', () => {
      expect(validators.skillLevel('LEAD')).toBe('Nivel de habilidad inválido')
    })
  })

  describe('validators.role', () => {
    it('debe aceptar roles válidos', () => {
      expect(validators.role('EMPLEADO')).toBeUndefined()
      expect(validators.role('ADMINISTRADOR')).toBeUndefined()
    })

    it('debe rechazar rol inválido', () => {
      expect(validators.role('INVALIDO')).toBe('Rol inválido')
    })
  })

  describe('validateForm', () => {
    it('debe detectar errores en formulario', () => {
      const data = { email: 'invalido', nombre: '' }
      const rules = {
        email: [validators.required, validators.email],
        nombre: [validators.required],
      }
      const result = validateForm(data, rules)
      expect(result.isValid).toBe(false)
      expect(result.errors.email).toBe('Correo inválido')
      expect(result.errors.nombre).toBe('Este campo es obligatorio')
    })

    it('debe retornar válido cuando no hay errores', () => {
      const data = { email: 'a@b.com', nombre: 'Juan' }
      const rules = {
        email: [validators.required, validators.email],
        nombre: [validators.required],
      }
      const result = validateForm(data, rules)
      expect(result.isValid).toBe(true)
      expect(Object.keys(result.errors)).toHaveLength(0)
    })
  })

  describe('isValidEmail', () => {
    it('debe validar correos', () => {
      expect(isValidEmail('test@empresa.com')).toBe(true)
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('no-es-un-correo')).toBe(false)
    })
  })

  describe('isPositiveNumber', () => {
    it('debe validar números positivos', () => {
      expect(isPositiveNumber(5)).toBe(true)
      expect(isPositiveNumber(0)).toBe(false)
      expect(isPositiveNumber(-3)).toBe(false)
      expect(isPositiveNumber('abc')).toBe(false)
    })
  })

  describe('isValidPercentage', () => {
    it('debe validar porcentajes', () => {
      expect(isValidPercentage(50)).toBe(true)
      expect(isValidPercentage(0)).toBe(true)
      expect(isValidPercentage(100)).toBe(true)
      expect(isValidPercentage(150)).toBe(false)
    })
  })

  describe('isValidSkillLevel', () => {
    it('debe validar niveles de habilidad', () => {
      expect(isValidSkillLevel('JUNIOR')).toBe(true)
      expect(isValidSkillLevel('MID')).toBe(true)
      expect(isValidSkillLevel('SENIOR')).toBe(true)
      expect(isValidSkillLevel('LEAD')).toBe(false)
    })
  })

  describe('isValidRole', () => {
    it('debe validar roles', () => {
      expect(isValidRole('EMPLEADO')).toBe(true)
      expect(isValidRole('ADMINISTRADOR')).toBe(true)
      expect(isValidRole('INVALIDO')).toBe(false)
    })
  })
})