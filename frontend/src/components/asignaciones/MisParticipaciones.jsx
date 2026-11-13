import { useEffect, useMemo, useState } from 'react'
import { asignacionesService } from '../../services/asignaciones.service.js'
import { proyectosService } from '../../services/proyectos.service.js'
import { extractItems } from '../../utils/apiResponses.js'
import { getApiErrorMessage } from '../../utils/apiErrors.js'
import { obtenerFechasProyecto, formatoFechaProyecto } from '../../utils/proyectoFechas.js'
import './mis-participaciones.css'

const estados = { ACTIVA: 'Activa', FINALIZADA: 'Finalizada', DESVINCULADA: 'Desvinculada' }

export default function MisParticipaciones() {
  const [registros, setRegistros] = useState([])
  const [estado, setEstado] = useState('ACTIVA')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [sinPerfil, setSinPerfil] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    const cargar = async () => {
      setCargando(true)
      setError('')
      setAviso('')
      setSinPerfil(false)
      try {
        // La API obtiene el perfil de la identidad Cognito, no de un ID enviado por el navegador.
        const respuesta = await asignacionesService.listMine()
        if (respuesta.data?.datos?.tienePerfil === false) {
          if (vigente) { setRegistros([]); setSinPerfil(true) }
          return
        }
        const asignaciones = extractItems(respuesta.data)
        const ids = [...new Set(asignaciones.map(item => item.proyectoId).filter(Boolean))]
        const consultas = await Promise.allSettled(ids.map(id => proyectosService.get(id)))
        const nombres = new Map(ids.map((id, indice) => [
          id, consultas[indice].status === 'fulfilled' ? consultas[indice].value.data?.datos : null,
        ]))
        if (!vigente) return

        setRegistros(asignaciones.map(asignacion => {
          const proyecto = nombres.get(asignacion.proyectoId)
          const fechas = obtenerFechasProyecto(proyecto || {})
          return {
            ...asignacion,
            nombreProyecto: proyecto?.nombre || asignacion.proyectoId || 'Proyecto no disponible',
            inicio: asignacion.fechaInicio || fechas.inicio,
            fin: asignacion.fechaFin || fechas.fin,
            finEstimado: !asignacion.fechaFin && fechas.estimada,
          }
        }))
        if (consultas.some(item => item.status === 'rejected')) {
          setAviso('Algunos proyectos no pudieron consultarse. Se muestran sus asignaciones con la información disponible.')
        }
      } catch (fallo) {
        if (!vigente) return
        if (fallo.response?.status === 404) {
          setError('La consulta de asignaciones personales no está disponible en la API. Verifica que el backend actualizado esté desplegado.')
        } else {
          setError(getApiErrorMessage(fallo, 'No se pudieron cargar tus asignaciones como colaborador.'))
        }
        setRegistros([])
      } finally {
        if (vigente) setCargando(false)
      }
    }
    void cargar()
    return () => { vigente = false }
  }, [recarga])

  const visibles = useMemo(() => registros.filter(item =>
    estado === 'TODOS' || item.estado === estado), [registros, estado])
  const activas = registros.filter(item => item.estado === 'ACTIVA')

  return (
    <section className="lider-participaciones" id="mis-participaciones" aria-labelledby="lider-participaciones-titulo">
      <div className="lider-participaciones-encabezado">
        <div>
          <h2 id="lider-participaciones-titulo">Mis participaciones como colaborador</h2>
          <p>Proyectos de otros líderes en los que participas. Puedes consultar estas asignaciones, pero no administrarlas.</p>
        </div>
        <button type="button" className="lider-asignaciones-secondary"
          onClick={() => setRecarga(actual => actual + 1)} disabled={cargando}>Actualizar</button>
      </div>
      {!cargando && !sinPerfil && !error && (
        <div className="lider-participaciones-controles">
          <p><strong>{activas.length}</strong> asignaciones activas · <strong>
            {activas.reduce((total, item) => total + (Number(item.porcentajeDedicacion) || 0), 0)} %
          </strong> de dedicación reservada</p>
          <label>Estado
            <select aria-label="Filtrar mis participaciones por estado" value={estado}
              onChange={evento => setEstado(evento.target.value)}>
              <option value="ACTIVA">Activas</option>
              <option value="FINALIZADA">Finalizadas</option>
              <option value="DESVINCULADA">Desvinculadas</option>
              <option value="TODOS">Todo el historial</option>
            </select>
          </label>
        </div>
      )}
      {cargando && <p role="status">Consultando tus participaciones...</p>}
      {sinPerfil && !cargando && <p>No tienes un perfil de colaborador registrado. No hay participaciones personales que mostrar.</p>}
      {error && <p role="alert" className="lider-participaciones-error">{error}</p>}
      {aviso && <p role="status" className="lider-participaciones-error">{aviso}</p>}
      {!cargando && !sinPerfil && !error && (
        visibles.length ? (
          <div className="lider-participaciones-scroll">
            <table>
              <thead><tr><th>Proyecto</th><th>Dedicación</th><th>Horas</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead>
              <tbody>
                {visibles.map(item => (
                  <tr key={item.asignacionId}>
                    <td><strong>{item.nombreProyecto}</strong></td>
                    <td>{item.porcentajeDedicacion ?? '—'} %</td>
                    <td>{item.horasCompletadas ?? 0} / {item.horasAsignadas ?? '—'} h</td>
                    <td>{formatoFechaProyecto(item.inicio)}</td>
                    <td>{formatoFechaProyecto(item.fin)}{item.finEstimado ? ' (estimada)' : ''}</td>
                    <td>{estados[item.estado] || item.estado || 'Sin estado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="lider-participaciones-vacio">No hay participaciones que coincidan con el estado seleccionado.</p>
      )}
    </section>
  )
}
