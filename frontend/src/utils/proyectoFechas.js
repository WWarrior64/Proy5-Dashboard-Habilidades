const HORAS_POR_JORNADA = 8

function fechaUtc(valor) {
  if (!valor) return null
  let texto = String(valor).slice(0, 10)
  if (String(valor).includes('T')) {
    const instante = new Date(valor)
    if (Number.isNaN(instante.getTime())) return null
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(instante)
    const leer = tipo => partes.find(parte => parte.type === tipo)?.value
    texto = `${leer('year')}-${leer('month')}-${leer('day')}`
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null
  const fecha = new Date(`${texto}T00:00:00.000Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto ? fecha : null
}

const iso = fecha => fecha?.toISOString().slice(0, 10) || null
const esLaborable = fecha => fecha.getUTCDay() !== 0 && fecha.getUTCDay() !== 6

/** Estimación simple para una jornada de 8 horas de lunes a viernes, sin festivos. */
export function estimarFinProyecto(inicio, horasRequeridas) {
  const fecha = fechaUtc(inicio)
  const horas = Number(horasRequeridas)
  if (!fecha || !Number.isFinite(horas) || horas <= 0) return null

  let jornadas = Math.ceil(horas / HORAS_POR_JORNADA)
  while (!esLaborable(fecha)) fecha.setUTCDate(fecha.getUTCDate() + 1)
  jornadas -= 1 // La primera jornada corresponde al día de inicio.
  const semanas = Math.floor(jornadas / 5)
  fecha.setUTCDate(fecha.getUTCDate() + semanas * 7)
  let restantes = jornadas % 5
  while (restantes > 0) {
    fecha.setUTCDate(fecha.getUTCDate() + 1)
    if (esLaborable(fecha)) restantes -= 1
  }
  return iso(fecha)
}

/** Prefiere las fechas planificadas; si faltan, utiliza la publicación y calcula el fin. */
export function obtenerFechasProyecto(proyecto) {
  const inicioRegistrado = fechaUtc(proyecto?.fechaInicio)
  const publicacion = fechaUtc(proyecto?.fechaPublicacion)
  const alta = fechaUtc(proyecto?.fechaCreacion)
  const inicio = inicioRegistrado || publicacion || (proyecto?.estado === 'BORRADOR' ? null : alta)
  const finReal = fechaUtc(proyecto?.fechaFin)
  const finEstimado = finReal ? null : estimarFinProyecto(iso(inicio), proyecto?.horasRequeridas)
  let origenInicio = null
  if (inicioRegistrado) origenInicio = 'planificada'
  else if (publicacion) origenInicio = 'publicación'
  else if (alta && inicio) origenInicio = 'creación'
  return {
    inicio: iso(inicio),
    fin: iso(finReal) || finEstimado,
    estimada: !finReal && Boolean(finEstimado),
    origenInicio,
  }
}

export function formatoFechaProyecto(valor) {
  const fecha = fechaUtc(valor)
  return fecha ? `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${fecha.getUTCFullYear()}` : 'Sin fecha'
}

export function rangoFechasProyecto(proyecto) {
  const fechas = obtenerFechasProyecto(proyecto)
  return `${formatoFechaProyecto(fechas.inicio)} – ${formatoFechaProyecto(fechas.fin)}${fechas.estimada ? ' (fin estimado)' : ''}`
}
