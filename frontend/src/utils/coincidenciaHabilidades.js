const niveles = { JUNIOR: 1, MID: 2, SENIOR: 3 }

// Coincidencia del empleado: aplica los niveles y pesos registrados en el proyecto.
// El buscador /busqueda/colaboradores aún aplica un nivel global sin pesos.
export function coincidenciaHabilidades(requisitos, habilidades = []) {
  if (!Array.isArray(requisitos) || !Array.isArray(habilidades)) {
    return { porcentaje: null, cumpleObligatorias: false, faltantes: [] }
  }
  if (!requisitos.length) return { porcentaje: null, cumpleObligatorias: true, faltantes: [] }
  let sumaPesos = 0
  let pesosCumplidos = 0
  let cumpleObligatorias = true
  const faltantes = []
  for (const requisito of requisitos) {
    const peso = Number.isFinite(Number(requisito.peso)) && Number(requisito.peso) >= 0
      ? Number(requisito.peso) : 1
    sumaPesos += peso
    const existente = habilidades.find(item => item.habilidadId === requisito.habilidadId)
    const cumple = Boolean(existente && (niveles[existente.nivel] || 0) >=
      (niveles[requisito.nivelMinimo] || 1))
    if (cumple) pesosCumplidos += peso
    else {
      faltantes.push(requisito)
      if (requisito.esObligatoria !== false) cumpleObligatorias = false
    }
  }
  return { porcentaje: sumaPesos > 0 ? Math.round(pesosCumplidos / sumaPesos * 100) : null,
    cumpleObligatorias, faltantes }
}

export const tieneAltaCoincidencia = resultado =>
  resultado?.porcentaje != null && resultado.porcentaje >= 70 && resultado.cumpleObligatorias === true
