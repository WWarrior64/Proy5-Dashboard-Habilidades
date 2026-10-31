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