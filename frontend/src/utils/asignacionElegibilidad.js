/** Impide asignar al líder como colaborador a un proyecto bajo su responsabilidad. */
export function esCandidatoAsignable(colaborador, proyecto) {
  if (!colaborador || !proyecto) return false
  if (colaborador.esEjemplo || proyecto.esEjemplo) return true
  return Boolean(colaborador.usuarioId && proyecto.liderId &&
    colaborador.usuarioId !== proyecto.liderId)
}
