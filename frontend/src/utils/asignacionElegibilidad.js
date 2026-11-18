import { disponibilidadCalculada, porcentajeLibre } from './disponibilidad.js'

const niveles = { JUNIOR: 1, MID: 2, SENIOR: 3 }

/** Impide asignar al líder como colaborador a un proyecto bajo su responsabilidad. */
export function esCandidatoAsignable(colaborador, proyecto) {
  if (!colaborador || !proyecto) return false
  if (colaborador.esEjemplo || proyecto.esEjemplo) return true
  return Boolean(colaborador.usuarioId && proyecto.liderId &&
    colaborador.usuarioId !== proyecto.liderId)
}

// Comprobación preventiva de interfaz. El backend es la autoridad definitiva.
export function evaluarAsignacion({ colaborador, proyecto, asignaciones = [], requisitos = null,
  habilidades = null, porcentaje = 1, usuario = null, asignacionActual = null }) {
  const motivos = []
  if (colaborador?.esEjemplo || proyecto?.esEjemplo) {
    return { elegible: true, motivos, libre: 100 }
  }
  if (!esCandidatoAsignable(colaborador, proyecto)) motivos.push('El líder no puede asignarse a su propio proyecto')
  if (proyecto?.estado !== 'ACTIVO') motivos.push('El proyecto no está activo')
  if (colaborador?.estado !== 'ACTIVO') motivos.push('El colaborador está inactivo')
  if (usuario?.estado === 'INACTIVO' || colaborador?.usuarioEstado === 'INACTIVO') motivos.push('La cuenta del usuario está desactivada')
  const disponibilidad = disponibilidadCalculada(colaborador, usuario)
  if (colaborador?.disponibilidad === 'NO_DISPONIBLE' || (!asignacionActual && disponibilidad === 'NO_DISPONIBLE')) {
    motivos.push('El colaborador no está disponible')
  }
  const libre = porcentajeLibre(colaborador)
  if (libre === null || disponibilidad === 'SIN_DATOS') motivos.push('No se pudo verificar la dedicación disponible')
  if (!Number.isFinite(porcentaje) || porcentaje <= 0 || libre === null || porcentaje > libre +
    (asignacionActual?.porcentajeDedicacion || 0)) motivos.push('La dedicación solicitada supera el porcentaje disponible')
  if (!asignacionActual && asignaciones.some(a =>
    a.proyectoId === proyecto?.proyectoId && a.colaboradorId === colaborador?.colaboradorId)) {
    motivos.push('El colaborador ya está registrado en el proyecto')
  }
  if (!Array.isArray(requisitos) || !Array.isArray(habilidades)) {
    motivos.push('No fue posible verificar las habilidades requeridas')
  } else {
    for (const requisito of requisitos.filter(item => item.esObligatoria !== false)) {
      const habilidad = habilidades.find(item => item.habilidadId === requisito.habilidadId)
      if (!habilidad || (niveles[habilidad.nivel] || 0) < (niveles[requisito.nivelMinimo] || 1)) {
        motivos.push('Falta habilidad obligatoria: ' + (requisito.nombre || requisito.habilidadId))
      }
    }
  }
  return { elegible: motivos.length === 0, motivos, libre }
}
