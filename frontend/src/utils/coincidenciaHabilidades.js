const niveles = { JUNIOR: 1, MID: 2, SENIOR: 3 }

// Coincidencia del empleado: aplica los niveles y pesos registrados en el proyecto.
// Aplica niveles individuales, obligatoriedad y pesos según el contrato del backend.
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
      if (requisito.esObligatoria === true) cumpleObligatorias = false
    }
  }
  return { porcentaje: cumpleObligatorias && sumaPesos > 0 ? Math.round(pesosCumplidos / sumaPesos * 100) : 0,
    cumpleObligatorias, faltantes }
}

export const tieneAltaCoincidencia = resultado =>
  resultado?.porcentaje != null && resultado.porcentaje >= 70 && resultado.cumpleObligatorias === true
