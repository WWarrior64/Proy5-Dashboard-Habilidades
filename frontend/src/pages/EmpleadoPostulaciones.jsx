import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Eye, Search, Trash2, UserRound, X } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { postulacionesService } from '../services/postulaciones.service.js'
import { proyectosService } from '../services/proyectos.service.js'
import { extractItems } from '../utils/apiResponses.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import { nombreLiderProyecto } from '../utils/formatters.js'
import './empleado-postulaciones.css'

// Ejemplos visuales: se reemplazarán por las solicitudes reales al integrar el backend.
const postulacionesIniciales = [
  {
    id: 1, proyecto: 'API empresarial', lider: 'Laura Vega', fechaPostulacion: '03/11/2026',
    estado: 'En revisión', observacion: 'Sin observación', fechaRevision: '—',
  },
  {
    id: 2, proyecto: 'Portal de clientes', lider: 'Martín Ruiz', fechaPostulacion: '28/10/2026',
    estado: 'Aceptada', observacion: 'Perfil acorde a los requisitos', fechaRevision: '30/10/2026',
  },
  {
    id: 3, proyecto: 'Sistema Web', lider: 'Sofía Gómez', fechaPostulacion: '20/10/2026',
    estado: 'Aceptada', observacion: 'Disponibilidad confirmada', fechaRevision: '22/10/2026',
  },
  {
    id: 4, proyecto: 'App móvil', lider: 'Diego Torres', fechaPostulacion: '15/10/2026',
    estado: 'Rechazada', observacion: 'Nivel mínimo de Flutter no alcanzado', fechaRevision: '18/10/2026',
  },
]

const menu = [
  ['Dashboard', '/dashboards/empleado'],
  ['Mis habilidades', '/habilidades'],
  ['Proyectos disponibles', '/proyectos'],
  ['Mis postulaciones', '/postulaciones'],
  ['Mis asignaciones', '/asignaciones'],
]

const estados = [
  { nombre: 'En revisión', estilo: 'revision' },
  { nombre: 'Aceptada', etiqueta: 'Aceptadas', estilo: 'aceptada' },
  { nombre: 'Rechazada', etiqueta: 'Rechazadas', estilo: 'rechazada' },
  { nombre: 'Retirada', etiqueta: 'Retiradas', estilo: 'retirada' },
]

function claseEstado(estado) {
  return estados.find(item => item.nombre === estado)?.estilo || 'retirada'
}

const modoDemo = import.meta.env.VITE_DEMO_MODE === 'true'
const nombreEstado = { PENDIENTE: 'En revisión', ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada', RETIRADA: 'Retirada' }
const fechaVisible = valor => valor ? new Date(valor).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '—'

export default function EmpleadoPostulaciones() {
  const [postulaciones, setPostulaciones] = useState(modoDemo ? postulacionesIniciales : [])
  const [colaboradorId, setColaboradorId] = useState(null)
  const [cargando, setCargando] = useState(!modoDemo)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [detalle, setDetalle] = useState(null)
  const [porRetirar, setPorRetirar] = useState(null)

  useEffect(() => {
    if (modoDemo) return undefined
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        const perfil = await colaboradoresService.getMe()
        const colaborador = perfil.data?.datos
        if (!colaborador?.colaboradorId) throw new Error('La cuenta no tiene un perfil de colaborador.')
        const [respuesta, proyectosRespuesta] = await Promise.all([
          postulacionesService.listByCollaborator(colaborador.colaboradorId),
          proyectosService.list(),
        ])
        const proyectos = new Map(extractItems(proyectosRespuesta.data).map(item => [item.proyectoId, item]))
        const items = extractItems(respuesta.data).map(item => ({
          ...item,
          id: item.postulacionId || item.proyectoId,
          proyecto: proyectos.get(item.proyectoId)?.nombre || item.proyectoId,
          lider: nombreLiderProyecto(proyectos.get(item.proyectoId)),
          fechaPostulacion: fechaVisible(item.fechaPostulacion),
          fechaRevision: fechaVisible(item.fechaRevision),
          observacion: item.observacionRevision || 'Sin observación',
          estado: nombreEstado[item.estado] || item.estado,
        }))
        if (!cancelado) {
          setColaboradorId(colaborador.colaboradorId)
          setPostulaciones(items)
        }
      } catch (fallo) {
        if (!cancelado) setError(getApiErrorMessage(fallo, 'No se pudieron consultar las postulaciones.'))
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [])

  const visibles = useMemo(() => {
    const termino = [busqueda, busquedaSuperior].map(valor => valor.trim().toLocaleLowerCase('es'))
    return postulaciones.filter(postulacion => {
      const contenido = [postulacion.proyecto, postulacion.lider].join(' ').toLocaleLowerCase('es')
      return termino.every(texto => contenido.includes(texto)) &&
        (filtroEstado === 'Todos' || postulacion.estado === filtroEstado)
    })
  }, [postulaciones, busqueda, busquedaSuperior, filtroEstado])

  const contadores = {
    total: postulaciones.length,
    revision: postulaciones.filter(item => item.estado === 'En revisión').length,
    aceptadas: postulaciones.filter(item => item.estado === 'Aceptada').length,
    rechazadas: postulaciones.filter(item => item.estado === 'Rechazada').length,
  }

  const eliminarPostulacion = async () => {
    if (porRetirar === null || guardando) return
    const postulacion = postulaciones.find(item => item.id === porRetirar)
    if (!postulacion || postulacion.estado !== 'En revisión') return
    setGuardando(true)
    setError('')
    try {
      if (!modoDemo) await postulacionesService.withdraw(postulacion.proyectoId, colaboradorId)
      setPostulaciones(actuales => actuales.map(item => item.id === porRetirar
        ? { ...item, estado: 'Retirada', fechaRevision: fechaVisible(new Date().toISOString()) }
        : item))
      setPorRetirar(null)
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo retirar la postulación.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="emp-dashboard emp-applications-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de empleado">
            {menu.map(([nombre, ruta]) => (
              <NavLink key={ruta} to={ruta} end className={({ isActive }) =>
                'emp-sidebar-item' + (isActive ? ' active' : '')
              }>{nombre}</NavLink>
            ))}
          </nav>
        </div>
        <div className="emp-sidebar-bottom"><div className="emp-sidebar-user">Empleado</div><EmpleadoLogoutButton /></div>
      </aside>

      <main className="emp-main">
        <header className="emp-header">
          <h1 className="emp-header-title">Mis postulaciones</h1>
          <div className="emp-header-right">
            <input
              type="search"
              className="emp-search"
              aria-label="Buscar postulaciones desde el encabezado"
              placeholder="Buscar..."
              value={busquedaSuperior}
              onChange={evento => setBusquedaSuperior(evento.target.value)}
            />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content emp-applications-content" aria-labelledby="applications-title">
          <div className="emp-applications-intro">
            <h2 id="applications-title">Mis postulaciones</h2>
          </div>

          {cargando && <p role="status">Consultando postulaciones...</p>}
          {error && <p role="alert">{error}</p>}
          <div className="emp-applications-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Total</p>
              <p className="emp-card-value">{contadores.total}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">En revisión</p>
              <p className="emp-card-value metric-review">{contadores.revision}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Aceptadas</p>
              <p className="emp-card-value metric-accepted">{contadores.aceptadas}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Rechazadas</p>
              <p className="emp-card-value metric-rejected">{contadores.rechazadas}</p>
            </div>
          </div>

          <div className="emp-applications-filters">
            <label className="emp-applications-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar proyecto o líder"
                placeholder="Buscar proyecto o líder..."
                value={busqueda}
                onChange={evento => setBusqueda(evento.target.value)}
              />
            </label>
            <select
              aria-label="Filtrar por estado"
              value={filtroEstado}
              onChange={evento => setFiltroEstado(evento.target.value)}
            >
              <option value="Todos">Estado: Todos</option>
              {estados.map(estado => (
                <option key={estado.nombre} value={estado.nombre}>{estado.etiqueta || estado.nombre}</option>
              ))}
            </select>
          </div>

          <div className="emp-applications-table-panel">
            <div className="emp-applications-table-scroll">
              <table className="emp-applications-table">
                <thead>
                  <tr>
                    <th>Proyecto</th>
                    <th>Líder</th>
                    <th>Fecha de postulación</th>
                    <th>Estado</th>
                    <th>Observación de revisión</th>
                    <th>Fecha de revisión</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(item => (
                    <tr key={item.id}>
                      <td>{item.proyecto}</td>
                      <td>{item.lider}</td>
                      <td>{item.fechaPostulacion}</td>
                      <td><span className={'emp-applications-status ' + claseEstado(item.estado)}>{item.estado}</span></td>
                      <td className={item.observacion === 'Sin observación' ? 'emp-applications-muted' : ''}>
                        {item.observacion}
                      </td>
                      <td>{item.fechaRevision}</td>
                      <td>
                        <div className="emp-applications-actions">
                          <button
                            type="button"
                            className="emp-applications-view"
                            onClick={() => setDetalle(item)}
                            aria-label={'Ver detalles de ' + item.proyecto}
                            title={'Ver detalles de ' + item.proyecto}
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>
                          {item.estado === 'En revisión' && <button
                            type="button"
                            className="emp-applications-withdraw"
                            onClick={() => setPorRetirar(item.id)}
                            aria-label={'Retirar postulación a ' + item.proyecto}
                            title={'Retirar postulación a ' + item.proyecto}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibles.length === 0 && (
                <p className="emp-applications-empty">No se encontraron postulaciones con esos filtros.</p>
              )}
            </div>
            <p className="emp-applications-total">
              Mostrando {visibles.length} de {postulaciones.length} postulaciones
            </p>
          </div>
        </section>
      </main>

      {detalle && (
        <div className="emp-applications-overlay" onMouseDown={evento => {
          if (evento.target === evento.currentTarget) setDetalle(null)
        }}>
          <section className="emp-applications-modal" role="dialog" aria-modal="true" aria-labelledby="application-detail-title">
            <div className="emp-applications-modal-heading">
              <h2 id="application-detail-title">Detalle de postulación</h2>
              <button type="button" onClick={() => setDetalle(null)} aria-label="Cerrar detalle"><X size={18} /></button>
            </div>
            <dl>
              <dt>Proyecto</dt><dd>{detalle.proyecto}</dd>
              <dt>Líder</dt><dd>{detalle.lider}</dd>
              <dt>Fecha de postulación</dt><dd>{detalle.fechaPostulacion}</dd>
              <dt>Estado</dt><dd><span className={'emp-applications-status ' + claseEstado(detalle.estado)}>{detalle.estado}</span></dd>
              <dt>Observación</dt><dd>{detalle.observacion}</dd>
              <dt>Fecha de revisión</dt><dd>{detalle.fechaRevision}</dd>
            </dl>
            <button type="button" className="emp-applications-close" onClick={() => setDetalle(null)}>Cerrar</button>
          </section>
        </div>
      )}

      {porRetirar !== null && (
        <div className="emp-applications-overlay" onMouseDown={evento => {
          if (evento.target === evento.currentTarget) setPorRetirar(null)
        }}>
          <section className="emp-applications-modal" role="alertdialog" aria-modal="true" aria-labelledby="application-withdraw-title" aria-describedby="application-withdraw-description">
            <h2 id="application-withdraw-title">Retirar postulación</h2>
            <p id="application-withdraw-description">¿Deseas retirar esta postulación? Su historial se conservará con estado Retirada.</p>
            <div className="emp-applications-modal-buttons">
              <button type="button" className="emp-applications-cancel" onClick={() => setPorRetirar(null)}>Cancelar</button>
              <button type="button" className="emp-applications-close" onClick={eliminarPostulacion} disabled={guardando}>{guardando ? 'Retirando...' : 'Retirar'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
