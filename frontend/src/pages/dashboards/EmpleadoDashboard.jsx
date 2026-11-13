import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BriefcaseBusiness, CheckCircle2, Clock3, UserRound, UsersRound } from 'lucide-react'
import EmpleadoLogoutButton from '../../components/layout/EmpleadoLogoutButton.jsx'
import api from '../../services/api.js'
import { colaboradoresService } from '../../services/colaboradores.service.js'
import { proyectosService } from '../../services/proyectos.service.js'
import { postulacionesService } from '../../services/postulaciones.service.js'
import { asignacionesService } from '../../services/asignaciones.service.js'
import { habilidadesService } from '../../services/habilidades.service.js'
import { extractItems } from '../../utils/apiResponses.js'
import { getApiErrorMessage } from '../../utils/apiErrors.js'
import { rangoFechasProyecto } from '../../utils/proyectoFechas.js'
import './empleado-dashboard.css'

// Valores de ejemplo compartidos conceptualmente con las vistas del Empleado.
// Hasta integrar los endpoints en esas pantallas, este resumen es una vista previa.
const habilidadesEjemplo = ['Senior', 'Senior', 'Senior', 'Mid', 'Mid', 'Junior', 'Mid', 'Junior']

const oportunidadesEjemplo = [
  { id: 1, nombre: 'Portal de clientes', habilidades: 'React · Mid, SQL · Mid', horas: 80, coincidencia: 92 },
  { id: 2, nombre: 'API empresarial', habilidades: 'Node.js · Mid, AWS · Junior', horas: 60, coincidencia: 78 },
  { id: 3, nombre: 'App móvil', habilidades: 'Flutter · Mid', horas: 100, coincidencia: 35 },
]

const asignacionesEjemplo = [
  { id: 1, proyecto: 'Portal de clientes', dedicacion: 40, horasCompletadas: 12, horasAsignadas: 40 },
  { id: 2, proyecto: 'Sistema Web', dedicacion: 20, horasCompletadas: 8, horasAsignadas: 30 },
]

const postulacionesEjemplo = [
  { id: 1, proyecto: 'API empresarial', estado: 'En revisión', fecha: '03/11/2026' },
  { id: 2, proyecto: 'Portal de clientes', estado: 'Aceptada', fecha: '30/10/2026' },
  { id: 3, proyecto: 'Sistema Web', estado: 'Aceptada', fecha: '22/10/2026' },
  { id: 4, proyecto: 'App móvil', estado: 'Rechazada', fecha: '18/10/2026' },
]

const modoDemo = import.meta.env.VITE_DEMO_MODE === 'true'
const niveles = { JUNIOR: 1, MID: 2, SENIOR: 3 }
const fechas = valor => valor ? new Date(valor).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '—'
const estados = { PENDIENTE: 'En revisión', ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada', RETIRADA: 'Retirada' }

export default function EmpleadoDashboard() {
  const [datos, setDatos] = useState({
    habilidades: modoDemo ? habilidadesEjemplo : [],
    oportunidades: modoDemo ? oportunidadesEjemplo : [],
    asignaciones: modoDemo ? asignacionesEjemplo : [],
    postulaciones: modoDemo ? postulacionesEjemplo : [],
  })
  const [cargando, setCargando] = useState(!modoDemo)
  const [error, setError] = useState('')
  const [searchHeader, setSearchHeader] = useState('')
  useEffect(() => {
    if (modoDemo) return undefined
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        const [perfil, proyectosRespuesta, catalogoRespuesta] = await Promise.all([
          colaboradoresService.getMe(),
          proyectosService.list(),
          habilidadesService.listAll(),
        ])
        const id = perfil.data?.datos?.colaboradorId
        if (!id) throw new Error('La cuenta no tiene un perfil de colaborador.')
        const proyectos = extractItems(proyectosRespuesta.data)
        const activos = proyectos.filter(item => item.estado === 'ACTIVO')
        const proyectosPorId = new Map(proyectos.map(item => [item.proyectoId, item]))
        const nombresHabilidades = new Map(extractItems(catalogoRespuesta.data).map(item => [item.habilidadId, item.nombre]))
        const [skillsRespuesta, asignacionesRespuesta, postulacionesRespuesta, ...requisitos] = await Promise.all([
          colaboradoresService.listSkills(id),
          asignacionesService.listByCollaborator(id),
          postulacionesService.listByCollaborator(id),
          ...activos.map(item => api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/habilidades`)
            .then(response => extractItems(response.data)).catch(() => null)),
        ])
        const skills = extractItems(skillsRespuesta.data)
        const nivelesEmpleado = new Map(skills.map(item => [item.habilidadId, niveles[item.nivel] || 0]))
        const oportunidades = activos.map((item, indice) => {
          const requeridas = requisitos[indice]
          const coincidencia = !requeridas?.length ? null : Math.round(requeridas.filter(relacion =>
            (nivelesEmpleado.get(relacion.habilidadId) || 0) >= (niveles[relacion.nivelMinimo] || 1),
          ).length / requeridas.length * 100)
          return {
            id: item.proyectoId,
            nombre: item.nombre,
            habilidades: requeridas?.map(relacion =>
              `${nombresHabilidades.get(relacion.habilidadId) || relacion.habilidadId} · ${relacion.nivelMinimo || 'JUNIOR'}`).join(', ') || 'Requisitos sin registrar',
            horas: item.horasRequeridas,
            fechas: rangoFechasProyecto(item),
            coincidencia,
          }
        })
        const asignaciones = extractItems(asignacionesRespuesta.data).map(item => ({
          id: item.asignacionId,
          proyecto: proyectosPorId.get(item.proyectoId)?.nombre || item.proyectoId,
          dedicacion: item.porcentajeDedicacion || 0,
          horasCompletadas: item.horasCompletadas || 0,
          horasAsignadas: item.horasAsignadas || 0,
          estado: item.estado,
        }))
        const postulaciones = extractItems(postulacionesRespuesta.data)
          .sort((a, b) => (b.fechaPostulacion || '').localeCompare(a.fechaPostulacion || ''))
          .map(item => ({
          id: item.postulacionId,
          proyecto: proyectosPorId.get(item.proyectoId)?.nombre || item.proyectoId,
          estado: estados[item.estado] || item.estado,
          fecha: fechas(item.fechaPostulacion),
        }))
        if (!cancelado) {
          setDatos({
            habilidades: skills.map(item => item.nivel === 'SENIOR' ? 'Senior' : item.nivel === 'MID' ? 'Mid' : 'Junior'),
            oportunidades,
            asignaciones,
            postulaciones,
          })
        }
      } catch (fallo) {
        if (!cancelado) setError(getApiErrorMessage(fallo, 'No se pudo cargar el resumen del empleado.'))
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [])

  const busqueda = searchHeader.trim().toLocaleLowerCase('es')
  const oportunidades = useMemo(() => datos.oportunidades.filter(item =>
    [item.nombre, item.habilidades].join(' ').toLocaleLowerCase('es').includes(busqueda)), [datos.oportunidades, busqueda])
  const asignaciones = useMemo(() => datos.asignaciones.filter(item =>
    item.estado === 'ACTIVA' || (modoDemo && !item.estado)).filter(item =>
    item.proyecto.toLocaleLowerCase('es').includes(busqueda)), [datos.asignaciones, busqueda])
  const postulaciones = useMemo(() => datos.postulaciones.slice(0, 2).filter(item =>
    [item.proyecto, item.estado].join(' ').toLocaleLowerCase('es').includes(busqueda)), [datos.postulaciones, busqueda])
  const dedicacionTotal = datos.asignaciones.filter(item => modoDemo || item.estado === 'ACTIVA')
    .reduce((total, item) => total + item.dedicacion, 0)

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', to: '/dashboards/empleado' },
    { key: 'habilidades', label: 'Mis habilidades', to: '/habilidades' },
    { key: 'proyectos', label: 'Proyectos disponibles', to: '/proyectos' },
    { key: 'postulaciones', label: 'Mis postulaciones', to: '/postulaciones' },
    { key: 'asignaciones', label: 'Mis asignaciones', to: '/asignaciones' },
  ]

  return (
    <div className="emp-dashboard emp-dashboard-page">
      {/* Sidebar */}
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">
            INTERNAL<br />MARKETPLACE
          </div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu">
            {menuItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  'emp-sidebar-item' + (isActive ? ' active' : '')
                }
                end={item.key === 'dashboard'}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="emp-sidebar-bottom">
          <div className="emp-sidebar-user">Empleado</div>
          <EmpleadoLogoutButton />
        </div>
      </aside>

      {/* Main area */}
      <main className="emp-main">
        {/* Header */}
        <header className="emp-header">
          <h1 className="emp-header-title">Dashboard</h1>
          <div className="emp-header-right">
            <input
              type="text"
              className="emp-search"
              placeholder="Buscar..."
              value={searchHeader}
              onChange={(e) => setSearchHeader(e.target.value)}
            />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} />
            </NavLink>
          </div>
        </header>

        {/* Contenido renovado; sidebar y barra superior permanecen sin cambios. */}
        <div className="emp-content dashboard-content">
          <div className="emp-dashboard-intro">
            <h2 className="dashboard-section-label">Resumen general</h2>
            <span className="emp-dashboard-preview">{modoDemo ? 'Datos de ejemplo' : cargando ? 'Cargando datos' : 'Datos de tu cuenta'}</span>
            {error && <p role="alert">{error}</p>}
          </div>

          <div className="emp-metrics">
            <div className="emp-card emp-dashboard-metric">
              <div className="emp-dashboard-metric-text">
                <p className="emp-card-label">Habilidades registradas</p>
                <p className="emp-card-value">{datos.habilidades.length}</p>
                <p className="emp-dashboard-metric-note">{datos.habilidades.filter(nivel => nivel === 'Senior').length} de nivel Senior</p>
              </div>
              <span className="emp-dashboard-metric-icon"><UsersRound size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card emp-dashboard-metric">
              <div className="emp-dashboard-metric-text">
                <p className="emp-card-label">Proyectos disponibles</p>
                <p className="emp-card-value">{datos.oportunidades.length}</p>
                <p className="emp-dashboard-metric-note">Según tu perfil</p>
              </div>
              <span className="emp-dashboard-metric-icon"><BriefcaseBusiness size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card emp-dashboard-metric">
              <div className="emp-dashboard-metric-text">
                <p className="emp-card-label">Postulaciones</p>
                <p className="emp-card-value">{datos.postulaciones.length}</p>
                <p className="emp-dashboard-metric-note">{datos.postulaciones.filter(item => item.estado === 'En revisión').length} en revisión</p>
              </div>
              <span className="emp-dashboard-metric-icon"><CheckCircle2 size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card emp-dashboard-metric">
              <div className="emp-dashboard-metric-text">
                <p className="emp-card-label">Asignaciones</p>
                <p className="emp-card-value">{datos.asignaciones.filter(item => modoDemo || item.estado === 'ACTIVA').length}</p>
                <p className="emp-dashboard-metric-note">Dedicación total {dedicacionTotal} %</p>
              </div>
              <span className="emp-dashboard-metric-icon"><Clock3 size={19} aria-hidden="true" /></span>
            </div>
          </div>

          <div className="emp-dashboard-panels">
            <section className="emp-dashboard-panel" aria-labelledby="emp-recomendaciones">
              <h2 id="emp-recomendaciones">Oportunidades recomendadas</h2>
              <div className="emp-dashboard-panel-list">
                {oportunidades.map(item => (
                  <Link to="/proyectos" className="emp-dashboard-opportunity" key={item.id}>
                    <div className="emp-dashboard-row-copy">
                      <strong>{item.nombre}</strong>
                      <p>{item.habilidades} — {item.horas} h</p>
                      {item.fechas && <p>{item.fechas}</p>}
                    </div>
                    <span className={'emp-dashboard-match ' + (
                      item.coincidencia == null ? 'baja' : item.coincidencia >= 85 ? 'alta' : item.coincidencia >= 60 ? 'media' : 'baja'
                    )}>{item.coincidencia == null ? '—' : item.coincidencia + ' %'}</span>
                  </Link>
                ))}
                {!oportunidades.length && <p className="emp-dashboard-empty">No hay oportunidades que coincidan con la búsqueda.</p>}
              </div>
            </section>

            <section className="emp-dashboard-panel" aria-labelledby="emp-mis-asignaciones">
              <h2 id="emp-mis-asignaciones">Mis asignaciones activas</h2>
              <div className="emp-dashboard-panel-list">
                {asignaciones.map(item => (
                  <Link to="/asignaciones" className="emp-dashboard-assignment" key={item.id}>
                    <div className="emp-dashboard-row-copy">
                      <strong>{item.proyecto}</strong>
                      <p>Dedicación {item.dedicacion} %</p>
                    </div>
                    <div className="emp-dashboard-assignment-progress">
                      <div className="emp-dashboard-progress"><span style={{
                        width: (item.horasAsignadas > 0 ? Math.min(100, item.horasCompletadas / item.horasAsignadas * 100) : 0) + '%',
                      }} /></div>
                      <span>{item.horasCompletadas} / {item.horasAsignadas} h</span>
                    </div>
                  </Link>
                ))}
                {!asignaciones.length && <p className="emp-dashboard-empty">No hay asignaciones que coincidan con la búsqueda.</p>}
                {!busqueda && (
                  <div className="emp-dashboard-assignment emp-dashboard-dedication">
                    <div className="emp-dashboard-row-copy">
                      <strong>Dedicación total</strong>
                      <p>Máximo permitido: 100 %</p>
                    </div>
                    <div className="emp-dashboard-assignment-progress">
                      <div className="emp-dashboard-progress"><span style={{ width: Math.min(100, dedicacionTotal) + '%' }} /></div>
                      <span>{dedicacionTotal} %</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="emp-dashboard-panel emp-dashboard-actions-panel" aria-labelledby="emp-acciones-rapidas">
              <h2 id="emp-acciones-rapidas">Acciones rápidas</h2>
              <div className="emp-dashboard-quick-actions">
                <Link to="/habilidades">Agregar habilidad</Link>
                <Link to="/proyectos">Ver proyectos</Link>
                <Link to="/postulaciones">Mis postulaciones</Link>
              </div>
            </section>

            <section className="emp-dashboard-panel emp-dashboard-status-panel" aria-labelledby="emp-estado-postulaciones">
              <h2 id="emp-estado-postulaciones">Estado de mis postulaciones</h2>
              <div className="emp-dashboard-panel-list">
                {postulaciones.map(item => (
                  <Link to="/postulaciones" className="emp-dashboard-application" key={item.id}>
                    <div className="emp-dashboard-row-copy">
                      <strong>{item.proyecto}</strong>
                      <p>{item.estado === 'En revisión' ? 'Enviada' : 'Revisada'} el {item.fecha}</p>
                    </div>
                    <span className={'emp-dashboard-application-state ' + (
                      item.estado === 'En revisión' ? 'revision' : item.estado === 'Aceptada' ? 'aceptada' : item.estado === 'Retirada' ? 'retirada' : 'rechazada'
                    )}>{item.estado}</span>
                  </Link>
                ))}
                {!postulaciones.length && <p className="emp-dashboard-empty">No hay postulaciones que coincidan con la búsqueda.</p>}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}