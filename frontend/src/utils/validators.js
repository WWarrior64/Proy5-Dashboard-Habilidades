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