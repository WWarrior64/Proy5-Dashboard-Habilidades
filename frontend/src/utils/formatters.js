/** Muestra la identidad de la cuenta y nunca confunde el cargo profesional con el nombre. */
export function nombreColaborador(item) {
  const nombre = [item?.nombreUsuario, item?.nombreCompleto, item?.usuario?.nombre, item?.nombre]
    .find(valor => typeof valor === 'string' && valor.trim())?.trim()
  const rol = String(item?.rolProfesional || item?.rol || '').trim()
  if (nombre && (!rol || nombre.toLocaleLowerCase('es') !== rol.toLocaleLowerCase('es'))) {
    return nombre
  }
  const id = String(item?.colaboradorId || '').trim()
  return id ? `Colaborador ${id}` : 'Colaborador sin nombre registrado'
}

/** Nombre público resuelto por la API de Proyectos, compartido por las vistas del Empleado. */
export function nombreLiderProyecto(proyecto) {
  const nombre = [proyecto?.liderNombre, proyecto?.lider?.nombre]
    .find(valor => typeof valor === 'string' && valor.trim())?.trim()
  return nombre || 'No registrado'
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('es-USD', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString('es-SV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatPercent(value) {
  return `${Number(value)}%`
}

export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function truncate(str, length = 30) {
  if (!str) return ''
  return str.length > length ? `${str.slice(0, length)}...` : str
}