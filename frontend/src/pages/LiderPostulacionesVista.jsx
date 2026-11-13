import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ClipboardCheck, Eye, Search, UserRound, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { proyectosService } from '../services/proyectos.service.js'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import api from '../services/api.js'
import './lider-postulaciones.css'

const menu = [
  ['Dashboard', '/dashboards/lider'],
  ['Mis proyectos', '/proyectos'],
  ['Buscar talento', '/colaboradores'],
  ['Postulaciones', '/postulaciones'],
  ['Asignaciones', '/asignaciones'],
]

const estados = {
  PENDIENTE: { texto: 'En revisión', clase: 'revision' },
  ACEPTADA: { texto: 'Aceptada', clase: 'aceptada' },
  RECHAZADA: { texto: 'Rechazada', clase: 'rechazada' },
  RETIRADA: { texto: 'Retirada', clase: 'retirada' },
}

// Registros exclusivamente visuales durante el desarrollo. Nunca se envían a la API.
const ejemplosIniciales = [
  { postulacionId: '__ejemplo_ana', colaboradorId: '__ejemplo_ana', proyectoId: '__ejemplo_portal', candidato: 'Ana López', proyecto: 'Portal de clientes', fechaPostulacion: '2026-11-04', estado: 'PENDIENTE', comentario: 'Experiencia en React y diseño de interfaces.', esEjemplo: true },
  { postulacionId: '__ejemplo_luis', colaboradorId: '__ejemplo_luis', proyectoId: '__ejemplo_api', candidato: 'Luis Pérez', proyecto: 'API empresarial', fechaPostulacion: '2026-11-03', estado: 'PENDIENTE', comentario: 'Interés en servicios de backend.', esEjemplo: true },
  { postulacionId: '__ejemplo_carlos', colaboradorId: '__ejemplo_carlos', proyectoId: '__ejemplo_web', candidato: 'Carlos Méndez', proyecto: 'Sistema Web', fechaPostulacion: '2026-11-02', estado: 'ACEPTADA', observacionRevision: 'Cumple los requisitos.', esEjemplo: true },
  { postulacionId: '__ejemplo_maria', colaboradorId: '__ejemplo_maria', proyectoId: '__ejemplo_movil', candidato: 'María Torres', proyecto: 'App móvil', fechaPostulacion: '2026-11-01', estado: 'RECHAZADA', observacionRevision: 'Se requiere mayor experiencia.', esEjemplo: true },
  { postulacionId: '__ejemplo_pedro', colaboradorId: '__ejemplo_pedro', proyectoId: '__ejemplo_erp', candidato: 'Pedro Sánchez', proyecto: 'ERP interno', fechaPostulacion: '2026-10-31', estado: 'ACEPTADA', observacionRevision: 'Perfil aprobado.', esEjemplo: true },
  { postulacionId: '__ejemplo_valeria', colaboradorId: '__ejemplo_valeria', proyectoId: '__ejemplo_cloud', candidato: 'Valeria Cruz', proyecto: 'Migración a la nube', fechaPostulacion: '2026-10-30', estado: 'RETIRADA', observacionRevision: 'Retirada por la colaboradora.', esEjemplo: true },
]

function obtenerItems(respuesta) {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}

function fechaCorta(fecha) {
  if (!fecha || typeof fecha !== 'string') return '—'
  const [anio, mes, dia] = fecha.slice(0, 10).split('-')
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '—'
}

function textoEstado(estado) {
  return estados[estado]?.texto || estado || 'Sin estado'
}

export default function LiderPostulacionesVista() {
  const { user } = useAuth()
  const [reales, setReales] = useState([])
  const [ejemplos, setEjemplos] = useState(ejemplosIniciales)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [porDecidir, setPorDecidir] = useState(null)
  const [observacion, setObservacion] = useState('')
  const [dedicacion, setDedicacion] = useState('25')
  const [horas, setHoras] = useState('20')
  const [guardando, setGuardando] = useState(false)
  const [errorDecision, setErrorDecision] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    if (!user?.usuarioId) {
      setReales([])
      setError('No se pudo identificar al líder de proyecto.')
      setCargando(false)
      return
    }

    try {
      const respuestaProyectos = await proyectosService.list({ liderId: user.usuarioId })
      const proyectos = obtenerItems(respuestaProyectos).filter(item => item.liderId === user.usuarioId)
      const [respuestaPersonas, ...resultados] = await Promise.allSettled([
        colaboradoresService.list({ limit: 100 }),
        ...proyectos.map(item => api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/postulaciones`)),
      ])

      const personas = respuestaPersonas.status === 'fulfilled'
        ? obtenerItems(respuestaPersonas.value) : []
      const nombresPersonas = new Map(personas.map(item => [
        item.colaboradorId, item.nombre || item.nombreCompleto || item.usuario?.nombre || '',
      ]))

      if (resultados.some(resultado => resultado.status === 'rejected')) {
        setError('No se pudieron consultar todas las postulaciones. Revisa la conexión y vuelve a intentar.')
      }

      const solicitudes = proyectos.flatMap((proyecto, indice) => (
        resultados[indice]?.status === 'fulfilled'
          ? obtenerItems(resultados[indice].value).map(item => ({
            ...item,
            proyectoId: proyecto.proyectoId,
            proyecto: proyecto.nombre,
            candidato: nombresPersonas.get(item.colaboradorId) ||
              item.candidatoNombre || item.nombreColaborador ||
              (item.colaboradorId ? 'Colaborador ' + String(item.colaboradorId).slice(0, 8) : 'Colaborador sin nombre'),
          }))
          : []
      ))
      setReales(solicitudes)
    } catch (fallo) {
      setReales([])
      setError(getApiErrorMessage(fallo, 'No se pudieron cargar las postulaciones.'))
    } finally {
      setCargando(false)
    }
  }, [user?.usuarioId])

  useEffect(() => { cargar() }, [cargar])

  const mostrarEjemplos = import.meta.env.DEV && !cargando
  const postulaciones = useMemo(() => [
    ...reales,
    ...(mostrarEjemplos ? ejemplos : []),
  ].sort((a, b) => (b.fechaPostulacion || '').localeCompare(a.fechaPostulacion || '')), [reales, ejemplos, mostrarEjemplos])

  const visibles = useMemo(() => {
    const terminos = [busqueda, busquedaSuperior].map(texto => texto.trim().toLocaleLowerCase('es'))
    return postulaciones.filter(item => {
      const contenido = [item.candidato, item.proyecto, textoEstado(item.estado)]
        .join(' ').toLocaleLowerCase('es')
      return terminos.every(texto => contenido.includes(texto)) &&
        (!estadoFiltro || item.estado === estadoFiltro)
    })
  }, [postulaciones, busqueda, busquedaSuperior, estadoFiltro])

  const contadores = {
    recibidas: postulaciones.length,
    revision: postulaciones.filter(item => item.estado === 'PENDIENTE').length,
    aceptadas: postulaciones.filter(item => item.estado === 'ACEPTADA').length,
    rechazadas: postulaciones.filter(item => item.estado === 'RECHAZADA').length,
  }

  const abrirDecision = item => {
    setPorDecidir(item)
    setErrorDecision('')
    setObservacion('')
    setDedicacion('25')
    setHoras('20')
  }

  const decidir = async nuevoEstado => {
    if (!porDecidir || porDecidir.estado !== 'PENDIENTE' || guardando) return
    const porcentajeDedicacion = Number(dedicacion)
    const horasAsignadas = Number(horas)
    if (nuevoEstado === 'ACEPTADA' && (
      !Number.isFinite(porcentajeDedicacion) || porcentajeDedicacion <= 0 || porcentajeDedicacion > 100 ||
      !Number.isFinite(horasAsignadas) || horasAsignadas <= 0
    )) {
      setErrorDecision('Para aceptar, indica una dedicación entre 1 y 100 % y horas mayores que cero.')
      return
    }
    setGuardando(true)
    setErrorDecision('')
    setMensaje('')

    try {
      if (porDecidir.esEjemplo) {
        setEjemplos(actuales => actuales.map(item =>
          item.postulacionId === porDecidir.postulacionId
            ? { ...item, estado: nuevoEstado, observacionRevision: observacion.trim(), fechaRevision: new Date().toISOString() }
            : item,
        ))
        setMensaje('Decisión de ejemplo registrada en esta pantalla. No se modificó el backend.')
      } else {
        await api.patch(
          `/proyectos/${encodeURIComponent(porDecidir.proyectoId)}/postulaciones/${encodeURIComponent(porDecidir.colaboradorId)}/estado`,
          {
            estado: nuevoEstado,
            revisadoPor: user.usuarioId,
            observacionRevision: observacion.trim(),
            ...(nuevoEstado === 'ACEPTADA' ? { porcentajeDedicacion, horasAsignadas } : {}),
          },
        )
        await cargar()
        setMensaje(nuevoEstado === 'ACEPTADA' ? 'Postulación aceptada y asignación creada.' : 'Postulación rechazada.')
      }
      setPorDecidir(null)
    } catch (fallo) {
      setErrorDecision(getApiErrorMessage(fallo, 'No se pudo registrar la decisión.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="emp-dashboard lider-postulaciones-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de líder de proyecto">
            {menu.map(([nombre, ruta]) => (
              <NavLink key={ruta} to={ruta} end className={({ isActive }) =>
                'emp-sidebar-item' + (isActive ? ' active' : '')
              }>{nombre}</NavLink>
            ))}
          </nav>
        </div>
        <div className="emp-sidebar-bottom">
          <span className="emp-sidebar-user">Líder de proyecto</span>
          <EmpleadoLogoutButton />
        </div>
      </aside>

      <main className="emp-main">
        <header className="emp-header">
          <h1 className="emp-header-title">Postulaciones</h1>
          <div className="emp-header-right">
            <input type="search" className="emp-search" placeholder="Buscar..."
              aria-label="Buscar postulaciones desde el encabezado"
              value={busquedaSuperior} onChange={evento => setBusquedaSuperior(evento.target.value)} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content lider-postulaciones-content" aria-labelledby="lider-postulaciones-titulo">
          <h2 id="lider-postulaciones-titulo" className="lider-postulaciones-title">Postulaciones</h2>

          <div className="lider-postulaciones-metrics">
            <div className="emp-card"><p className="emp-card-label">Recibidas</p><p className="emp-card-value">{cargando ? '—' : contadores.recibidas}</p></div>
            <div className="emp-card"><p className="emp-card-label">En revisión</p><p className="emp-card-value">{cargando ? '—' : contadores.revision}</p></div>
            <div className="emp-card"><p className="emp-card-label">Aceptadas</p><p className="emp-card-value">{cargando ? '—' : contadores.aceptadas}</p></div>
            <div className="emp-card"><p className="emp-card-label">Rechazadas</p><p className="emp-card-value">{cargando ? '—' : contadores.rechazadas}</p></div>
          </div>

          <section className="lider-postulaciones-panel" aria-labelledby="lider-solicitudes-titulo">
            <div className="lider-postulaciones-panel-header">
              <h3 id="lider-solicitudes-titulo">Solicitudes de participación</h3>
              <div className="lider-postulaciones-controls">
                <label className="lider-postulaciones-search">
                  <Search size={15} aria-hidden="true" />
                  <input type="search" placeholder="Buscar..." aria-label="Buscar empleado o proyecto"
                    value={busqueda} onChange={evento => setBusqueda(evento.target.value)} />
                </label>
                <select aria-label="Filtrar por estado" value={estadoFiltro} onChange={evento => setEstadoFiltro(evento.target.value)}>
                  <option value="">Estado: Todos</option>
                  <option value="PENDIENTE">En revisión</option>
                  <option value="ACEPTADA">Aceptadas</option>
                  <option value="RECHAZADA">Rechazadas</option>
                  <option value="RETIRADA">Retiradas</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="lider-postulaciones-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={cargar} disabled={cargando}>Reintentar</button>
              </div>
            )}
            {mensaje && <p className="lider-postulaciones-success" role="status">{mensaje}</p>}
            {mostrarEjemplos && (
              <p className="lider-postulaciones-preview" role="status">
                Vista previa: las solicitudes de ejemplo se muestran junto a las reales durante el desarrollo. Sus decisiones no afectan al backend.
              </p>
            )}

            {cargando ? (
              <p className="lider-postulaciones-empty" role="status">Cargando postulaciones...</p>
            ) : (
              <>
                <div className="lider-postulaciones-table-scroll">
                  <table className="lider-postulaciones-table">
                    <thead>
                      <tr><th>Empleado</th><th>Proyecto</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {visibles.map(item => (
                        <tr key={item.esEjemplo ? item.postulacionId : item.proyectoId + ':' + item.colaboradorId}>
                          <td className="lider-postulaciones-empleado">
                            {item.candidato}
                            {item.esEjemplo && <small>Ejemplo</small>}
                          </td>
                          <td>{item.proyecto}</td>
                          <td>{fechaCorta(item.fechaPostulacion)}</td>
                          <td>
                            <span className={'lider-postulaciones-status ' + (estados[item.estado]?.clase || 'retirada')}>
                              {textoEstado(item.estado)}
                            </span>
                          </td>
                          <td>
                            <div className="lider-postulaciones-actions">
                              <button type="button" aria-label={'Ver postulación de ' + item.candidato}
                                title={'Ver postulación de ' + item.candidato}
                                onClick={() => setDetalle(item)}>
                                <Eye size={16} aria-hidden="true" />
                              </button>
                              {item.estado === 'PENDIENTE' && (
                                <button type="button" className="lider-postulaciones-decide"
                                  aria-label={'Decidir sobre la postulación de ' + item.candidato}
                                  title={'Decidir sobre la postulación de ' + item.candidato}
                                  onClick={() => abrirDecision(item)}>
                                  <ClipboardCheck size={17} aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visibles.length && <p className="lider-postulaciones-empty">No se encontraron postulaciones con esos filtros.</p>}
                </div>
                <p className="lider-postulaciones-count">
                  Mostrando {visibles.length} de {postulaciones.length} postulaciones
                  {mostrarEjemplos ? ' · incluye datos de ejemplo' : ''}
                </p>
              </>
            )}
          </section>
        </section>
      </main>

      {detalle && (
        <div className="lider-postulaciones-overlay" onMouseDown={evento => {
          if (evento.target === evento.currentTarget) setDetalle(null)
        }}>
          <section className="lider-postulaciones-modal" role="dialog" aria-modal="true" aria-labelledby="lider-postulaciones-detalle-titulo">
            <div className="lider-postulaciones-modal-heading">
              <h2 id="lider-postulaciones-detalle-titulo">Detalle de postulación</h2>
              <button type="button" aria-label="Cerrar detalle" onClick={() => setDetalle(null)}><X size={18} /></button>
            </div>
            <dl>
              <dt>Empleado</dt><dd>{detalle.candidato}</dd>
              <dt>Proyecto</dt><dd>{detalle.proyecto}</dd>
              <dt>Fecha de postulación</dt><dd>{fechaCorta(detalle.fechaPostulacion)}</dd>
              <dt>Estado</dt><dd><span className={'lider-postulaciones-status ' + (estados[detalle.estado]?.clase || 'retirada')}>{textoEstado(detalle.estado)}</span></dd>
              <dt>Comentario</dt><dd>{detalle.comentario || 'Sin comentario'}</dd>
              <dt>Observación de revisión</dt><dd>{detalle.observacionRevision || 'Sin observación'}</dd>
              <dt>Fecha de revisión</dt><dd>{fechaCorta(detalle.fechaRevision)}</dd>
            </dl>
            {detalle.esEjemplo && <p className="lider-postulaciones-preview">Registro de ejemplo del frontend.</p>}
            <div className="lider-postulaciones-modal-actions">
              <button type="button" className="lider-postulaciones-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
              {detalle.estado === 'PENDIENTE' && (
                <button type="button" className="lider-postulaciones-primary" onClick={() => {
                  setDetalle(null)
                  abrirDecision(detalle)
                }}>Decidir</button>
              )}
            </div>
          </section>
        </div>
      )}

      {porDecidir && (
        <div className="lider-postulaciones-overlay" onMouseDown={evento => {
          if (evento.target === evento.currentTarget && !guardando) setPorDecidir(null)
        }}>
          <section className="lider-postulaciones-modal" role="dialog" aria-modal="true" aria-labelledby="lider-postulaciones-decision-titulo">
            <div className="lider-postulaciones-modal-heading">
              <h2 id="lider-postulaciones-decision-titulo">Decidir postulación</h2>
              <button type="button" aria-label="Cerrar decisión" disabled={guardando} onClick={() => setPorDecidir(null)}><X size={18} /></button>
            </div>
            <p className="lider-postulaciones-modal-desc">
              <strong>{porDecidir.candidato}</strong> solicita participar en <strong>{porDecidir.proyecto}</strong>.
            </p>
            {porDecidir.esEjemplo && <p className="lider-postulaciones-preview">Vista previa: la decisión solo cambiará el registro de ejemplo.</p>}
            {errorDecision && <p className="lider-postulaciones-error" role="alert">{errorDecision}</p>}
            <label>Observación de revisión (opcional)
              <textarea rows={3} maxLength={500} value={observacion}
                disabled={guardando} onChange={evento => setObservacion(evento.target.value)}
                placeholder="Motivo o comentarios sobre la solicitud" />
            </label>
            <div className="lider-postulaciones-modal-fields">
              <label>Dedicación al aceptar (%)
                <input type="number" min="1" max="100" step="1" value={dedicacion}
                  disabled={guardando} onChange={evento => setDedicacion(evento.target.value)} />
              </label>
              <label>Horas al aceptar
                <input type="number" min="1" step="1" value={horas}
                  disabled={guardando} onChange={evento => setHoras(evento.target.value)} />
              </label>
            </div>
            <p className="lider-postulaciones-modal-help">
              Al aceptar se crea una asignación con las horas y la dedicación indicadas. Al rechazar no se crea ninguna.
            </p>
            <div className="lider-postulaciones-modal-actions">
              <button type="button" className="lider-postulaciones-secondary" disabled={guardando}
                onClick={() => setPorDecidir(null)}>Volver</button>
              <button type="button" className="lider-postulaciones-reject" disabled={guardando}
                onClick={() => decidir('RECHAZADA')}>Rechazar</button>
              <button type="button" className="lider-postulaciones-primary" disabled={guardando}
                onClick={() => decidir('ACEPTADA')}>{guardando ? 'Guardando...' : 'Aceptar'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
