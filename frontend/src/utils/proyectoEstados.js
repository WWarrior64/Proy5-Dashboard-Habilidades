// Restricciones visuales del ciclo de vida; la API es quien confirma cada cambio.
export const TRANSICIONES = {
  BORRADOR: ['BORRADOR', 'ACTIVO', 'CANCELADO'],
  ACTIVO: ['ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO'],
  PAUSADO: ['PAUSADO', 'ACTIVO', 'COMPLETADO', 'CANCELADO'],
  COMPLETADO: ['COMPLETADO'],
  CANCELADO: ['CANCELADO'],
}
export const estadosPermitidos = estado => TRANSICIONES[estado || 'BORRADOR'] || ['BORRADOR']
export const proyectoEditable = proyecto => !['CANCELADO', 'COMPLETADO'].includes(proyecto?.estado)
export const puedeQuitarRequisito = (estado, total) => estado !== 'ACTIVO' || total > 1
