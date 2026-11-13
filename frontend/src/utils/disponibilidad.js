/** La disponibilidad real se deriva del porcentaje reservado por asignaciones. */
export function disponibilidadCalculada(colaborador) {
  if (!colaborador || colaborador.estado !== 'ACTIVO') return 'NO_DISPONIBLE'
  const reservado = colaborador.dedicacionReservada
  if (!Number.isFinite(reservado) || reservado < 0 || reservado > 100) return 'SIN_DATOS'
  if (reservado === 0) return 'DISPONIBLE'
  return reservado < 100 ? 'PARCIAL' : 'NO_DISPONIBLE'
}

export function porcentajeLibre(colaborador) {
  if (!colaborador || colaborador.estado !== 'ACTIVO') return 0
  const reservado = colaborador.dedicacionReservada
  return Number.isFinite(reservado) && reservado >= 0 && reservado <= 100 ? 100 - reservado : null
}
