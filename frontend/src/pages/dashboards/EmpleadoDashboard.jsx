import { useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BriefcaseBusiness, CheckCircle2, Clock3, UserRound, UsersRound } from 'lucide-react'
import EmpleadoLogoutButton from '../../components/layout/EmpleadoLogoutButton.jsx'
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

export default function EmpleadoDashboard() {
  const [searchHeader, setSearchHeader] = useState('')
  const busqueda = searchHeader.trim().toLocaleLowerCase('es')
  const oportunidades = useMemo(() => oportunidadesEjemplo.filter(item =>
    [item.nombre, item.habilidades].join(' ').toLocaleLowerCase('es').includes(busqueda)), [busqueda])
  const asignaciones = useMemo(() => asignacionesEjemplo.filter(item =>
    item.proyecto.toLocaleLowerCase('es').includes(busqueda)), [busqueda])
  const postulaciones = useMemo(() => postulacionesEjemplo.slice(0, 2).filter(item =>
    [item.proyecto, item.estado].join(' ').toLocaleLowerCase('es').includes(busqueda)), [busqueda])
  const dedicacionTotal = asignacionesEjemplo.reduce((total, item) => total + item.dedicacion, 0)

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
            <span className="emp-dashboard-preview">Datos de ejemplo</span>
          </div>

          <div className="emp-metrics">
            <div className="emp-card emp-dashboard-metric">
              <div className="emp-dashboard-metric-text">
                <p className="emp-card-label">Habilidades registradas</p>
                <p className="emp-card-value">{habilidadesEjemplo.length}</p>
                <p className="emp-dashboard-metric-note">{habilidadesEjemplo.filter(nivel => nivel === 'Senior').length} de nivel Senior</p>
              </div>
              <span className="emp-dashboard-metric-icon"><UsersRound size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card emp-dashboard-metric">
              <div className="emp-dashboard-metric-text">
                <p className="emp-card-label">Proyectos disponibles</p>
                <p className="emp-card-value">{oportunidadesEjemplo.length}</p>
                <p className="emp-dashboard-metric-note">Según tu perfil</p>
              </div>
              <span className="emp-dashboard-metric-icon"><BriefcaseBusiness size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card emp-dashboard-metric">
              <div className="emp-dashboard-metric-text">
                <p className="emp-card-label">Postulaciones</p>
                <p className="emp-card-value">{postulacionesEjemplo.length}</p>
                <p className="emp-dashboard-metric-note">{postulacionesEjemplo.filter(item => item.estado === 'En revisión').length} en revisión</p>
              </div>
              <span className="emp-dashboard-metric-icon"><CheckCircle2 size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card emp-dashboard-metric">
              <div className="emp-dashboard-metric-text">
                <p className="emp-card-label">Asignaciones</p>
                <p className="emp-card-value">{asignacionesEjemplo.length}</p>
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
                    </div>
                    <span className={'emp-dashboard-match ' + (
                      item.coincidencia >= 85 ? 'alta' : item.coincidencia >= 60 ? 'media' : 'baja'
                    )}>{item.coincidencia} %</span>
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
                        width: Math.min(100, item.horasCompletadas / item.horasAsignadas * 100) + '%',
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
                      item.estado === 'En revisión' ? 'revision' : item.estado === 'Aceptada' ? 'aceptada' : 'rechazada'
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