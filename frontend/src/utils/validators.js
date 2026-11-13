export const validators = {
  required: (value) => (value == null || value === '' ? 'Este campo es obligatorio' : undefined),
  email: (value) => {
    if (!value) return undefined
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(value) ? undefined : 'Correo inválido'
  },
  minLength: (len) => (value) =>
    value && value.length < len ? `Mínimo ${len} caracteres` : undefined,
  maxLength: (len) => (value) =>
    value && value.length > len ? `Máximo ${len} caracteres` : undefined,
  positiveNumber: (value) => {
    if (!value && value !== 0) return undefined
    const n = Number(value)
    return isNaN(n) || n < 0 ? 'Debe ser un número positivo' : undefined
  },
  percentage: (value) => {
    if (!value && value !== 0) return undefined
    const n = Number(value)
    if (isNaN(n)) return 'Debe ser un número'
    if (n < 0 || n > 100) return 'Debe estar entre 0 y 100'
    return undefined
  },
  phone: (value) => {
    if (!value) return undefined
    const re = /^[\d\s+()-]+$/
    return re.test(value) ? undefined : 'Teléfono inválido'
  },
  alphanumeric: (value) => {
    if (!value) return undefined
    const re = /^[a-zA-Z0-9\s]+$/
    return re.test(value) ? undefined : 'Solo se permiten letras y números'
  },
  skillLevel: (value) => {
    const validLevels = ['JUNIOR', 'MID', 'SENIOR']
    if (!value) return undefined
    return validLevels.includes(value) ? undefined : 'Nivel de habilidad inválido'
  },
  role: (value) => {
    const validRoles = ['EMPLEADO', 'RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR']
    if (!value) return undefined
    return validRoles.includes(value) ? undefined : 'Rol inválido'
  },
  colaboratorStatus: (value) => {
    const validStatuses = ['ACTIVO', 'INACTIVO']
    if (!value) return undefined
    return validStatuses.includes(value) ? undefined : 'Estado inválido'
  },
}

export function validateForm(data, rules) {
  const errors = {}
  Object.keys(rules).forEach((field) => {
    const fieldRules = Array.isArray(rules[field]) ? rules[field] : [rules[field]]
    for (const rule of fieldRules) {
      const error = rule(data[field])
      if (error) {
        errors[field] = error
        break
      }
    }
  })
  return { errors, isValid: Object.keys(errors).length === 0 }
}

/**
 * Valida un correo electrónico de forma estricta.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email) return false
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/**
 * Valida que un valor sea un número positivo.
 * @param {any} value
 * @returns {boolean}
 */
export function isPositiveNumber(value) {
  if (value === null || value === undefined || value === '') return false
  const n = Number(value)
  return !isNaN(n) && n > 0
}

/**
 * Valida que un valor sea un porcentaje válido (0-100).
 * @param {any} value
 * @returns {boolean}
 */
export function isValidPercentage(value) {
  if (value === null || value === undefined || value === '') return false
  const n = Number(value)
  return !isNaN(n) && n >= 0 && n <= 100
}

/**
 * Valida que un nivel de habilidad sea válido.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidSkillLevel(value) {
  return ['JUNIOR', 'MID', 'SENIOR'].includes(value)
}

/**
 * Valida que un rol sea válido.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidRole(value) {
  return ['EMPLEADO', 'RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'].includes(value)
}