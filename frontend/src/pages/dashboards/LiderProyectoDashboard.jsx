import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BriefcaseBusiness, CheckCircle2, Clock3, UserRound, UsersRound } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import EmpleadoLogoutButton from '../../components/layout/EmpleadoLogoutButton.jsx'
import { colaboradoresService } from '../../services/colaboradores.service.js'
import { proyectosService } from '../../services/proyectos.service.js'
import { rangoFechasProyecto } from '../../utils/proyectoFechas.js'
import api from '../../services/api.js'
import './lider-proyecto-dashboard.css'

const menu = [
  ['Dashboard', '/dashboards/lider'],
  ['Mis proyectos', '/proyectos'],
  ['Buscar talento', '/colaboradores'],
  ['Postulaciones', '/postulaciones'],
  ['Asignaciones', '/asignaciones'],
]

// Referencias de diseño únicamente para desarrollo; nunca se envían a la API.
const postulacionesEjemplo = [
  { postulacionId: 'ejemplo-1', candidato: 'Ana López', proyecto: 'Portal de clientes', coincidencia: 92, estado: 'PENDIENTE', fechaPostulacion: '2026-11-04', esEjemplo: true },
  { postulacionId: 'ejemplo-2', candidato: 'Diego Rivas', proyecto: 'API empresarial', coincidencia: 86, estado: 'PENDIENTE', fechaPostulacion: '2026-11-03', esEjemplo: true },
  { postulacionId: 'ejemplo-3', candidato: 'Valeria Cruz', proyecto: 'Portal de clientes', coincidencia: 81, estado: 'PENDIENTE', fechaPostulacion: '2026-11-02', esEjemplo: true },
  { postulacionId: 'ejemplo-4', candidato: 'Carlos Méndez', proyecto: 'Portal de clientes', coincidencia: 90, estado: 'ACEPTADA', fechaPostulacion: '2026-10-31', esEjemplo: true },
  { postulacionId: 'ejemplo-5', candidato: 'Sofía Ramírez', proyecto: 'API empresarial', coincidencia: 78, estado: 'ACEPTADA', fechaPostulacion: '2026-10-29', esEjemplo: true },
  { postulacionId: 'ejemplo-6', candidato: 'Pedro Sánchez', proyecto: 'App móvil', coincidencia: 83, estado: 'ACEPTADA', fechaPostulacion: '2026-10-27', esEjemplo: true },
  { postulacionId: 'ejemplo-7', candidato: 'María Torres', proyecto: 'Portal de clientes', coincidencia: 67, estado: 'RECHAZADA', fechaPostulacion: '2026-10-25', esEjemplo: true },
  { postulacionId: 'ejemplo-8', candidato: 'Luis Pérez', proyecto: 'API empresarial', coincidencia: 75, estado: 'RECHAZADA', fechaPostulacion: '2026-10-23', esEjemplo: true },
  { postulacionId: 'ejemplo-9', candidato: 'Camila Ortiz', proyecto: 'App móvil', coincidencia: 69, estado: 'RETIRADA', fechaPostulacion: '2026-10-21', esEjemplo: true },
]

const proyectosEjemplo = [
  { proyectoId: 'ejemplo-portal', nombre: 'Portal de clientes', horasRequeridas: 80, horasAsignadas: 80, estado: 'ACTIVO', fechaInicio: '2026-11-01', fechaFin: '2026-12-15', esEjemplo: true },
  { proyectoId: 'ejemplo-api', nombre: 'API empresarial', horasRequeridas: 60, horasAsignadas: 0, estado: 'ACTIVO', fechaInicio: '2026-11-10', fechaFin: '2026-12-20', esEjemplo: true },
  { proyectoId: 'ejemplo-movil', nombre: 'App móvil', horasRequeridas: 100, horasAsignadas: 0, estado: 'ACTIVO', fechaInicio: '2026-11-15', fechaFin: '2027-01-31', esEjemplo: true },
  { proyectoId: 'ejemplo-interno', nombre: 'Proyecto interno', horasRequeridas: 40, horasAsignadas: 0, estado: 'BORRADOR', esEjemplo: true },
]

const asignacionesEjemplo = [
  { asignacionId: 'ejemplo-asignacion-1', proyectoId: 'ejemplo-portal', estado: 'ACTIVA' },
  { asignacionId: 'ejemplo-asignacion-2', proyectoId: 'ejemplo-portal', estado: 'ACTIVA' },
]

const formatoFecha = valor => {
  if (!valor) return 'Sin fecha'
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-')
  return anio && mes && dia ? dia + '/' + mes + '/' + anio : 'Sin fecha'
}
const numero = valor => Number.isFinite(Number(valor)) && valor != null ? Number(valor) : 0

function extraerItems(respuesta) {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}

export default function LiderProyectoDashboard() {
  const { user } = useAuth()
  const [datos, setDatos] = useState({
    colaboradores: null, proyectos: null, asignaciones: null, postulaciones: null,
  })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [busquedaSuperior, setBusquedaSuperior] = useState('')

  useEffect(() => {
    if (!user?.usuarioId) {
      setCargando(false)
      return
    }
    let cancelado = false

    const cargar = async () => {
      setCargando(true)
      setError('')
      const [resultadoColaboradores, resultadoProyectos] = await Promise.allSettled([
        colaboradoresService.listAll(),
        proyectosService.list({ liderId: user.usuarioId }),
      ])
      if (cancelado) return

      const colaboradores = resultadoColaboradores.status === 'fulfilled'
        ? extraerItems(resultadoColaboradores.value) : null
      const proyectos = resultadoProyectos.status === 'fulfilled'
        ? extraerItems(resultadoProyectos.value).filter(item => item.liderId === user.usuarioId) : null

      let asignaciones = null
      let postulaciones = null
      let errorRelaciones = false

      if (proyectos) {
        const [resultadosAsignaciones, resultadosPostulaciones] = await Promise.all([
          Promise.allSettled(proyectos.map(item =>
            api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/asignaciones`),
          )),
          Promise.allSettled(proyectos.map(item =>
            api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/postulaciones`),
          )),
        ])
        if (cancelado) return

        if (resultadosAsignaciones.every(item => item.status === 'fulfilled')) {
          asignaciones = resultadosAsignaciones.flatMap((item, indice) => extraerItems(item.value).map(asignacion => ({
            ...asignacion, proyectoId: proyectos[indice].proyectoId,
          })))
        } else errorRelaciones = true

        if (resultadosPostulaciones.every(item => item.status === 'fulfilled')) {
          postulaciones = resultadosPostulaciones.flatMap((item, indice) => extraerItems(item.value).map(postulacion => ({
            ...postulacion, proyectoId: proyectos[indice].proyectoId,
          })))
        } else errorRelaciones = true
      }

      setDatos({ colaboradores, proyectos, asignaciones, postulaciones })
      if (!colaboradores || !proyectos || errorRelaciones) {
        setError('No se pudo cargar toda la información del dashboard. Puedes volver a intentarlo.')
      }
      setCargando(false)
    }

    cargar()
    return () => { cancelado = true }
  }, [user?.usuarioId, recarga])

  const vistaPrevia = import.meta.env.VITE_DEMO_MODE === 'true' && !cargando && !error
  const mostrarProyectosEjemplo = vistaPrevia && datos.proyectos?.length === 0
  const mostrarPostulacionesEjemplo = vistaPrevia && datos.postulaciones?.length === 0
  const mostrarCandidatosEjemplo = vistaPrevia && datos.colaboradores?.length === 0

  const proyectos = mostrarProyectosEjemplo ? proyectosEjemplo : (datos.proyectos || [])
  const asignaciones = mostrarProyectosEjemplo ? asignacionesEjemplo : (datos.asignaciones || [])
  const proyectosActivos = proyectos.filter(item => item.estado === 'ACTIVO')
  const pendientesReales = datos.postulaciones?.filter(item => item.estado === 'PENDIENTE').length
  const resumen = {
    proyectos: datos.proyectos == null ? '—' : proyectos.length,
    proyectosActivos: datos.proyectos == null ? '—' : proyectosActivos.length,
    postulaciones: datos.postulaciones == null ? '—'
      : mostrarPostulacionesEjemplo ? postulacionesEjemplo.length : datos.postulaciones.length,
    pendientes: datos.postulaciones == null ? '—'
      : mostrarPostulacionesEjemplo ? postulacionesEjemplo.filter(item => item.estado === 'PENDIENTE').length : pendientesReales,
    candidatos: datos.colaboradores == null ? '—'
      : mostrarCandidatosEjemplo ? 12
        : datos.colaboradores.filter(item => item.estado === 'ACTIVO' &&
          Number.isFinite(item.dedicacionReservada) && item.dedicacionReservada < 100).length,
    asignaciones: datos.asignaciones == null ? '—'
      : mostrarProyectosEjemplo ? asignacionesEjemplo.length
        : datos.asignaciones.filter(item => item.estado === 'ACTIVA').length,
  }

  const postulaciones = useMemo(() => {
    if (mostrarPostulacionesEjemplo) return postulacionesEjemplo
    if (!datos.postulaciones || !datos.proyectos) return []
    const nombresProyecto = new Map(datos.proyectos.map(item => [item.proyectoId, item.nombre]))
    const nombresColaborador = new Map((datos.colaboradores || []).map(item => [
      item.colaboradorId, item.nombre || item.nombreCompleto || '',
    ]))
    return [...datos.postulaciones]
      .sort((a, b) => (b.fechaPostulacion || '').localeCompare(a.fechaPostulacion || ''))
      .map((item, indice) => ({
        postulacionId: item.postulacionId || item.proyectoId + '-' + item.colaboradorId + '-' + indice,
        candidato: nombresColaborador.get(item.colaboradorId) ||
          item.candidatoNombre || item.nombreColaborador ||
          (item.colaboradorId ? 'Colaborador ' + String(item.colaboradorId).slice(0, 8) : 'Sin nombre registrado'),
        proyecto: nombresProyecto.get(item.proyectoId) || 'Proyecto sin nombre',
        fechaPostulacion: item.fechaPostulacion,
        coincidencia: (item.coincidencia == null && item.puntuacion == null) ||
          !Number.isFinite(Number(item.coincidencia ?? item.puntuacion))
          ? null : Math.round(Number(item.coincidencia ?? item.puntuacion)),
        estado: item.estado,
        esEjemplo: false,
      }))
  }, [datos.postulaciones, datos.proyectos, datos.colaboradores, mostrarPostulacionesEjemplo])

  const termino = busquedaSuperior.trim().toLocaleLowerCase('es')
  const porRevisar = postulaciones.filter(item => item.estado === 'PENDIENTE')
    .filter(item => [item.candidato, item.proyecto].join(' ').toLocaleLowerCase('es').includes(termino))
    .slice(0, 3)
  const proyectosVisibles = proyectosActivos.filter(item =>
    item.nombre.toLocaleLowerCase('es').includes(termino)).slice(0, 3)
  const proyectosSinEquipo = proyectosActivos.filter(item =>
    !asignaciones.some(asignacion => asignacion.proyectoId === item.proyectoId &&
      asignacion.estado === 'ACTIVA'))
  const atencion = [
    ...proyectosSinEquipo.slice(-1).map(item => ({
      key: item.proyectoId, titulo: item.nombre, descripcion: 'Sin colaboradores asignados',
      etiqueta: 'Sin equipo', ruta: '/asignaciones',
    })),
    ...(resumen.pendientes > 0 ? [{
      key: 'postulaciones', titulo: 'Postulaciones pendientes',
      descripcion: resumen.pendientes + ' solicitudes esperan tu decisión',
      etiqueta: resumen.pendientes + ' por revisar', ruta: '/postulaciones',
    }] : []),
  ].filter(item => [item.titulo, item.descripcion].join(' ').toLocaleLowerCase('es').includes(termino))
  const tieneDatosEjemplo = mostrarProyectosEjemplo || mostrarPostulacionesEjemplo || mostrarCandidatosEjemplo

  return (
    <div className="emp-dashboard lider-dashboard-page">
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
          <h1 className="emp-header-title">Dashboard</h1>
          <div className="emp-header-right">
            <input className="emp-search" type="search" placeholder="Buscar..."
              aria-label="Buscar postulaciones desde el encabezado"
              value={busquedaSuperior} onChange={evento => setBusquedaSuperior(evento.target.value)} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content lider-dashboard-content" aria-labelledby="lider-dashboard-titulo">
          <div className="lider-dashboard-intro">
            <h2 className="lider-dashboard-titulo" id="lider-dashboard-titulo">Resumen general</h2>
            {tieneDatosEjemplo && <span className="lider-dashboard-preview">Datos de ejemplo</span>}
          </div>

          <div className="lider-dashboard-metrics">
            <div className="emp-card lider-dashboard-metric">
              <div className="lider-dashboard-metric-text">
                <p className="emp-card-label">Mis proyectos</p>
                <p className="emp-card-value">{cargando ? '—' : resumen.proyectos}</p>
                <p className="lider-dashboard-metric-note">{cargando ? 'Cargando...' : resumen.proyectosActivos === '—' ? 'Sin datos' : resumen.proyectosActivos + ' activos'}</p>
              </div>
              <span className="lider-dashboard-metric-icon"><BriefcaseBusiness size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card lider-dashboard-metric">
              <div className="lider-dashboard-metric-text">
                <p className="emp-card-label">Postulaciones</p>
                <p className="emp-card-value">{cargando ? '—' : resumen.postulaciones}</p>
                <p className="lider-dashboard-metric-note">{cargando ? 'Cargando...' : resumen.pendientes === '—' ? 'Sin datos' : resumen.pendientes + ' por revisar'}</p>
              </div>
              <span className="lider-dashboard-metric-icon"><CheckCircle2 size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card lider-dashboard-metric">
              <div className="lider-dashboard-metric-text">
                <p className="emp-card-label">Candidatos</p>
                <p className="emp-card-value">{cargando ? '—' : resumen.candidatos}</p>
                <p className="lider-dashboard-metric-note">{mostrarCandidatosEjemplo ? 'Coincidencia alta' : 'Con disponibilidad'}</p>
              </div>
              <span className="lider-dashboard-metric-icon"><UsersRound size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card lider-dashboard-metric">
              <div className="lider-dashboard-metric-text">
                <p className="emp-card-label">Asignaciones</p>
                <p className="emp-card-value">{cargando ? '—' : resumen.asignaciones}</p>
                <p className="lider-dashboard-metric-note">En curso</p>
              </div>
              <span className="lider-dashboard-metric-icon"><Clock3 size={19} aria-hidden="true" /></span>
            </div>
          </div>

          {error && (
            <div className="lider-dashboard-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setRecarga(valor => valor + 1)}>Reintentar</button>
            </div>
          )}

          <div className="lider-dashboard-panels">
            <section className="lider-dashboard-overview-panel" aria-labelledby="lider-por-revisar-titulo">
              <h2 id="lider-por-revisar-titulo">Postulaciones por revisar</h2>
              <div className="lider-dashboard-panel-list">
                {!cargando && porRevisar.map(item => (
                  <Link key={item.postulacionId} className="lider-dashboard-overview-row" to="/postulaciones">
                    <div className="lider-dashboard-row-copy">
                      <strong>{item.candidato}{item.esEjemplo ? ' · Ejemplo' : ''}</strong>
                      <p>{item.proyecto} · {formatoFecha(item.fechaPostulacion)}</p>
                    </div>
                    <div className="lider-dashboard-row-badges">
                      {item.coincidencia != null && (
                        <span className="lider-dashboard-match">{item.coincidencia} %</span>
                      )}
                      <span className="lider-dashboard-review-status">En revisión</span>
                    </div>
                  </Link>
                ))}
                {cargando && <p className="lider-dashboard-empty">Cargando postulaciones...</p>}
                {!cargando && !porRevisar.length && <p className="lider-dashboard-empty">No hay postulaciones pendientes que coincidan con la búsqueda.</p>}
              </div>
            </section>

            <section className="lider-dashboard-overview-panel" aria-labelledby="lider-mis-proyectos-titulo">
              <h2 id="lider-mis-proyectos-titulo">Mis proyectos</h2>
              <div className="lider-dashboard-panel-list">
                {!cargando && proyectosVisibles.map(item => {
                  const horasCubiertas = item.esEjemplo ? numero(item.horasAsignadas)
                    : asignaciones.filter(asignacion => asignacion.proyectoId === item.proyectoId &&
                      asignacion.estado === 'ACTIVA').reduce((total, asignacion) =>
                        total + numero(asignacion.horasAsignadas), 0)
                  const totalHoras = numero(item.horasRequeridas)
                  const progreso = totalHoras > 0
                    ? Math.min(100, Math.round(horasCubiertas / totalHoras * 100)) : 0
                  return (
                    <Link key={item.proyectoId} to="/proyectos" className="lider-dashboard-overview-row">
                      <div className="lider-dashboard-row-copy">
                        <strong>{item.nombre}{item.esEjemplo ? ' · Ejemplo' : ''}</strong>
                        <p>{rangoFechasProyecto(item)}</p>
                      </div>
                      <div className="lider-dashboard-progress-column">
                        <div className="lider-dashboard-progress" role="progressbar"
                          aria-label={'Horas asignadas en ' + item.nombre} aria-valuenow={progreso}
                          aria-valuemin={0} aria-valuemax={100}>
                          <span style={{ width: progreso + '%' }} />
                        </div>
                        <span>{horasCubiertas} / {totalHoras || '—'} h</span>
                      </div>
                    </Link>
                  )
                })}
                {cargando && <p className="lider-dashboard-empty">Cargando proyectos...</p>}
                {!cargando && !proyectosVisibles.length && <p className="lider-dashboard-empty">No hay proyectos activos que coincidan con la búsqueda.</p>}
              </div>
            </section>

            <section className="lider-dashboard-overview-panel lider-dashboard-quick-panel" aria-labelledby="lider-acciones-titulo">
              <h2 id="lider-acciones-titulo">Acciones rápidas</h2>
              <div className="lider-dashboard-quick-actions">
                <Link to="/proyectos">Crear proyecto</Link>
                <Link to="/colaboradores">Buscar talento</Link>
                <Link to="/postulaciones">Ver postulaciones</Link>
                 <Link to="/asignaciones">Consultar mis participaciones</Link>
              </div>
            </section>

            <section className="lider-dashboard-overview-panel" aria-labelledby="lider-atencion-titulo">
              <h2 id="lider-atencion-titulo">Requiere tu atención</h2>
              <div className="lider-dashboard-panel-list">
                {!cargando && atencion.map(item => (
                  <Link key={item.key} to={item.ruta} className="lider-dashboard-overview-row">
                    <div className="lider-dashboard-row-copy">
                      <strong>{item.titulo}</strong>
                      <p>{item.descripcion}</p>
                    </div>
                    <span className="lider-dashboard-attention-tag">{item.etiqueta}</span>
                  </Link>
                ))}
                {cargando && <p className="lider-dashboard-empty">Revisando pendientes...</p>}
                {!cargando && !atencion.length && <p className="lider-dashboard-empty">No hay asuntos que requieran atención.</p>}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}