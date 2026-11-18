import BrandName from '../../components/common/BrandName.jsx'
import { useState, useEffect, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Clock3, ShieldCheck, UserCheck, UserRound, UsersRound } from 'lucide-react'
import EmpleadoLogoutButton from '../../components/layout/EmpleadoLogoutButton.jsx'
import './administrador-dashboard.css'
import { usuariosService } from '../../services/usuarios.service.js'
import { administracionService } from '../../services/administracion.service.js'
import api from '../../services/api.js'
import { proyectosService } from '../../services/proyectos.service.js'
import Statistics from '../../components/dashboard/Statistics.jsx'
import ActivityList from '../../components/dashboard/ActivityList.jsx'
import QuickActions from '../../components/dashboard/QuickActions.jsx'
import Button from '../../components/common/Button.jsx'
import Loading from '../../components/common/Loading.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { DEMO_USUARIOS, DEMO_ACTIVIDADES } from '../../data/demoData.js'
import { getApiErrorMessage } from '../../utils/apiErrors.js'
import { extractItems } from '../../utils/apiResponses.js'
import { etiquetaRol } from '../../utils/formatters.js'

const menu = [
  ['Dashboard', '/dashboards/administrador'],
  ['Usuarios', '/usuarios'],
  ['Roles y permisos', '/roles-permisos'],
  ['Configuración', '/configuracion'],
  ['Auditoría', '/auditoria'],
]

export default function AdministradorDashboard() {
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [actividadReciente, setActividadReciente] = useState([])
  const [datosCargados, setDatosCargados] = useState({ usuarios: false, proyectos: false, actividad: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [paginaActividad, setPaginaActividad] = useState(1)
  const [paginaUsuarios, setPaginaUsuarios] = useState(1)
  const [porPagina, setPorPagina] = useState(5)
  const demoMode = (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true')

  const loadDashboardData = useCallback(async () => {
    if (demoMode) return
    setLoading(true)
    setError(null)
    try {
      let diasActividad = 30
      let tamanoPagina = 5
      try {
        const config = await administracionService.getConfiguracion()
        const parametros = config.data?.datos?.parametros || []
        const dias = Number(parametros.find(item => item.id === 'dias-actividad-dashboard')?.valor)
        const pagina = Number(parametros.find(item => item.id === 'registros-pagina-dashboard')?.valor)
        if (Number.isInteger(dias) && dias >= 1 && dias <= 90) diasActividad = dias
        if (Number.isInteger(pagina) && pagina >= 3 && pagina <= 15) tamanoPagina = pagina
      } catch { /* Sin configuración disponible se conservan valores seguros. */ }
      setPorPagina(tamanoPagina)
      const [usuariosResp, proyectosResp, actividadResp] = await Promise.allSettled([
        usuariosService.listAll(),
        proyectosService.list({}),
        api.get('/dashboard/actividad', { params: { dias: diasActividad, limite: 100 } }),
      ])

      setDatosCargados({
        usuarios: usuariosResp.status === 'fulfilled',
        proyectos: proyectosResp.status === 'fulfilled',
        actividad: actividadResp.status === 'fulfilled',
      })
      if (usuariosResp.status === 'rejected') setError(getApiErrorMessage(usuariosResp.reason))
      if (proyectosResp.status === 'rejected') setError(getApiErrorMessage(proyectosResp.reason))
      if (actividadResp.status === 'rejected') setError(getApiErrorMessage(actividadResp.reason))
      if (actividadResp.status === 'fulfilled') {
        const eventos = actividadResp.value.data?.datos?.eventos || []
        const proyectosDisponibles = proyectosResp.status === 'fulfilled' ? extractItems(proyectosResp.value.data) : []
        const nombresProyecto = new Map(proyectosDisponibles.map(item => [item.proyectoId, item.nombre]))
        setActividadReciente(eventos.map(item => ({
          ...item,
          nombre: item.nombre || nombresProyecto.get(item.proyectoId) ||
            (item.tipo === 'asignacion' ? 'Proyecto no disponible' : 'Proyecto sin nombre'),
        })))
      }

      if (usuariosResp.status === 'fulfilled') {
        setUsuarios(extractItems(usuariosResp.value.data))
      }

      if (proyectosResp.status === 'fulfilled') {
        setProyectos(extractItems(proyectosResp.value.data))
      }
    } catch (err) {
      setError(err.message || 'Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [demoMode])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const totalUsuarios = demoMode ? DEMO_USUARIOS.length : datosCargados.usuarios ? usuarios.length : '—'
  const activosUsuarios = demoMode ? DEMO_USUARIOS.filter((u) => u.estado === 'ACTIVO').length
    : datosCargados.usuarios ? usuarios.filter((u) => u.estado === 'ACTIVO').length : '—'

  const stats = [
    { title: 'Usuarios', value: totalUsuarios, subtitle: `${activosUsuarios} activos`, icon: <UsersRound size={19} /> },
    { title: 'Activos', value: activosUsuarios, subtitle: 'Usuarios con acceso', icon: <UserCheck size={19} /> },
    { title: 'Roles', value: 4, subtitle: 'Empleado, RRHH, Líder, Admin', icon: <ShieldCheck size={19} /> },
    { title: 'Pendientes', value: demoMode ? 0 : datosCargados.proyectos ? proyectos.filter((p) => p.estado === 'BORRADOR').length : '—', subtitle: 'Proyectos por iniciar', icon: <Clock3 size={19} /> },
  ]

  const actividades = demoMode ? DEMO_ACTIVIDADES : actividadReciente
  const termino = busquedaSuperior.trim().toLocaleLowerCase('es')
  const actividadesVisibles = actividades.filter(item =>
    [item.tipo, item.nombre, item.fecha, item.estado].join(' ').toLocaleLowerCase('es').includes(termino))
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
  const usuariosVisibles = (demoMode ? DEMO_USUARIOS : usuarios).filter(item =>
    [item.nombre, item.email, item.rol, item.estado].join(' ').toLocaleLowerCase('es').includes(termino))
    .sort((a, b) => String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || '')))
  const totalPaginasActividad = Math.max(1, Math.ceil(actividadesVisibles.length / porPagina))
  const totalPaginasUsuarios = Math.max(1, Math.ceil(usuariosVisibles.length / porPagina))
  const paginaActualActividad = Math.min(paginaActividad, totalPaginasActividad)
  const paginaActualUsuarios = Math.min(paginaUsuarios, totalPaginasUsuarios)

  const quickActions = [
    { label: 'Gestionar usuarios', onClick: () => navigate('/usuarios') },
    { label: 'Gestionar colaboradores', onClick: () => navigate('/colaboradores') },
    { label: 'Gestionar proyectos', onClick: () => navigate('/proyectos') },
  ]

  return (
    <div className="emp-dashboard admin-dashboard-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand"><BrandName /></div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de administrador">
            {menu.map(([nombre, ruta]) => ruta ? (
              <NavLink key={nombre} to={ruta} end className={({ isActive }) =>
                'emp-sidebar-item' + (isActive ? ' active' : '')
              }>{nombre}</NavLink>
            ) : (
              <span key={nombre} className="emp-sidebar-item" aria-disabled="true" title="Próximamente" style={{ cursor: 'default' }}>
                {nombre}
              </span>
            ))}
          </nav>
        </div>
        <div className="emp-sidebar-bottom">
          <span className="emp-sidebar-user">Administrador</span>
          <EmpleadoLogoutButton />
        </div>
      </aside>

      <main className="emp-main">
        <header className="emp-header">
          <h1 className="emp-header-title">Dashboard</h1>
          <div className="emp-header-right">
            <input className="emp-search" type="search" placeholder="Buscar..."
              aria-label="Buscar usuarios y actividad desde el encabezado"
              value={busquedaSuperior} onChange={evento => { setBusquedaSuperior(evento.target.value); setPaginaActividad(1); setPaginaUsuarios(1) }} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>
        <section className="emp-content admin-dashboard-content" aria-labelledby="admin-dashboard-title">
          <h2 id="admin-dashboard-title" className="admin-dashboard-title">Resumen general</h2>
          {demoMode && <p className="admin-dashboard-preview">Modo demostración · Datos de ejemplo</p>}

    {loading ? (
      <div className="admin-dashboard-loading"><Loading /></div>
    ) : (
      <>
        {error && (
          <div className="admin-dashboard-error" role="alert">
            <p>{error}</p>
            <Button variant="outline" onClick={loadDashboardData}>Reintentar</Button>
          </div>
        )}
        <div className="admin-dashboard-statistics"><Statistics stats={stats} /></div>

        <div className="admin-dashboard-columns">
          <div className="admin-dashboard-panel admin-dashboard-activity">
            <ActivityList activities={actividadesVisibles.slice((paginaActualActividad - 1) * porPagina, paginaActualActividad * porPagina)} />
            <div className="admin-dashboard-paginacion" aria-label="Paginación de actividad reciente">
              <span>{actividadesVisibles.length} actividades · Página {paginaActualActividad} de {totalPaginasActividad}</span>
              <button type="button" disabled={paginaActualActividad <= 1} onClick={() => setPaginaActividad(p => p - 1)}>Anterior</button>
              <button type="button" disabled={paginaActualActividad >= totalPaginasActividad} onClick={() => setPaginaActividad(p => p + 1)}>Siguiente</button>
            </div>
          </div>

          <div className="card-section">
            <div className="card-section-header">
              <h2 className="card-section-title">Usuarios recientes</h2>
              <button type="button" className="admin-dashboard-actualizar" onClick={loadDashboardData} disabled={loading}>Actualizar</button>
            </div>
            <div className="card-section-body">
              {usuariosVisibles.length > 0 ? (
                <>
                  {usuariosVisibles.slice((paginaActualUsuarios - 1) * porPagina, paginaActualUsuarios * porPagina).map((u) => (
                    <div key={u.usuarioId} className="admin-dashboard-user-row">
                      <div>
                        <p className="admin-dashboard-user-name">{u.nombre}</p>
                        <p className="admin-dashboard-user-email">{u.email}</p>
                        <p className="admin-dashboard-user-date">{u.fechaCreacion ? `Registrado el ${new Date(u.fechaCreacion).toLocaleDateString('es-SV')}` : 'Fecha de registro no disponible'}</p>
                      </div>
                      <div className="admin-dashboard-user-meta">
                        <span className={'admin-dashboard-role' + (u.rol === 'ADMINISTRADOR' || u.rol === 'RRHH' ? ' manager' : '')}>{etiquetaRol(u.rol)}</span>
                        <p className={'admin-dashboard-user-state' + (u.estado === 'ACTIVO' ? ' active' : '')}>{u.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <EmptyState message="No hay usuarios recientes" icon="👥" />
              )}
              <div className="admin-dashboard-paginacion" aria-label="Paginación de usuarios recientes">
                <span>{usuariosVisibles.length} usuarios · Página {paginaActualUsuarios} de {totalPaginasUsuarios}</span>
                <button type="button" disabled={paginaActualUsuarios <= 1} onClick={() => setPaginaUsuarios(p => p - 1)}>Anterior</button>
                <button type="button" disabled={paginaActualUsuarios >= totalPaginasUsuarios} onClick={() => setPaginaUsuarios(p => p + 1)}>Siguiente</button>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-dashboard-columns admin-dashboard-lower">
          <div className="admin-dashboard-panel admin-dashboard-quick-actions">
            <QuickActions actions={quickActions} />
          </div>

          <div className="card-section">
            <div className="card-section-header">
              <h2 className="card-section-title">Acceso rápido</h2>
            </div>
            <div className="card-section-body">
              <p className="admin-dashboard-access-text">
                Utiliza las acciones rápidas para gestionar usuarios, colaboradores y proyectos. El menú lateral conserva las herramientas del Administrador.
              </p>
            </div>
          </div>
        </div>
      </>
    )}
        </section>
      </main>
    </div>
  )
}