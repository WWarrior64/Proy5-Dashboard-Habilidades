const NIVELES = { JUNIOR: 1, MID: 2, SENIOR: 3 }
const normalizar = valor => String(valor || '').trim().toLocaleLowerCase('es')

/**
 * Refleja el cálculo de requisitos ponderados del backend para mostrar también
 * a los perfiles no elegibles. La autorización final de asignación sigue siendo
 * exclusiva del servidor. Sin datos verificables no inventa un porcentaje.
 */
export function evaluarCoincidenciaVisible(habilidades, requisitos) {
  if (!Array.isArray(habilidades) || !Array.isArray(requisitos) || requisitos.length === 0) return null
  const cumplidas = []
  const faltantes = []
  let pesoTotal = 0
  let pesoCumplido = 0
  let obligatorioIncumplido = false

  for (const requisito of requisitos) {
    const pesoNumerico = Number(requisito.peso ?? 1)
    const peso = Number.isFinite(pesoNumerico) && pesoNumerico >= 0 ? pesoNumerico : 1
    const nivel = NIVELES[String(requisito.nivelMinimo || 'JUNIOR').toUpperCase()] || 1
    const encontrada = habilidades.find(habilidad =>
      (requisito.habilidadId && habilidad.habilidadId === requisito.habilidadId) ||
      (requisito.nombre && normalizar(habilidad.nombre) === normalizar(requisito.nombre)))
    const coincide = encontrada && (NIVELES[String(encontrada.nivel || '').toUpperCase()] || 0) >= nivel
    const nombre = requisito.nombre || requisito.habilidadId
    pesoTotal += peso
    if (coincide) {
      pesoCumplido += peso
      cumplidas.push(nombre)
    } else {
      faltantes.push(nombre)
      if (requisito.esObligatoria === true) obligatorioIncumplido = true
    }
  }
  return {
    // El porcentaje representa habilidades coincidentes, no elegibilidad.
    // Faltar una obligatoria impide asignar, pero no anula las demás coincidencias.
    puntuacion: pesoTotal === 0 ? 0 : Math.round((pesoCumplido / pesoTotal) * 100),
    coincidentes: cumplidas,
    faltantes,
    cumpleObligatorias: !obligatorioIncumplido,
  }
}
