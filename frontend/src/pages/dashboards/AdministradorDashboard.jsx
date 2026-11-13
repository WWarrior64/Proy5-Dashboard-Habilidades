import { useState, useEffect, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Clock3, ShieldCheck, UserCheck, UserRound, UsersRound } from 'lucide-react'
import EmpleadoLogoutButton from '../../components/layout/EmpleadoLogoutButton.jsx'
import './administrador-dashboard.css'
import { usuariosService } from '../../services/usuarios.service.js'
import { proyectosService } from '../../services/proyectos.service.js'
import Statistics from '../../components/dashboard/Statistics.jsx'
import ActivityList from '../../components/dashboard/ActivityList.jsx'
import QuickActions from '../../components/dashboard/QuickActions.jsx'
import Button from '../../components/common/Button.jsx'
import Loading from '../../components/common/Loading.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { DEMO_USUARIOS, DEMO_ACTIVIDADES } from '../../data/demoData.js'
import { getApiErrorMessage } from '../../utils/apiErrors.js'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

  const loadDashboardData = useCallback(async () => {
    if (demoMode) return
    setLoading(true)
    setError(null)
    try {
      const [usuariosResp, proyectosResp] = await Promise.allSettled([
        usuariosService.list({}),
        proyectosService.list({}),
      ])

      if (usuariosResp.status === 'rejected') setError(getApiErrorMessage(usuariosResp.reason))
      if (proyectosResp.status === 'rejected') setError(getApiErrorMessage(proyectosResp.reason))

      if (usuariosResp.status === 'fulfilled') {
        const data = usuariosResp.value.data
        let items = []
        if (data && data.datos && data.datos.items) items = data.datos.items
        else if (Array.isArray(data)) items = data
        else if (data && data.datos && Array.isArray(data.datos)) items = data.datos
        setUsuarios(items)
      }

      if (proyectosResp.status === 'fulfilled') {
        const data = proyectosResp.value.data
        let items = []
        if (Array.isArray(data)) items = data
        else if (data && data.datos && Array.isArray(data.datos)) items = data.datos
        setProyectos(items)
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

  const totalUsuarios = demoMode ? DEMO_USUARIOS.length : usuarios.length
  const activosUsuarios = demoMode ? DEMO_USUARIOS.filter((u) => u.estado === 'ACTIVO').length : usuarios.filter((u) => u.estado === 'ACTIVO').length

  const stats = [
    { title: 'Usuarios', value: totalUsuarios, subtitle: `${activosUsuarios} activos`, icon: <UsersRound size={19} /> },
    { title: 'Activos', value: activosUsuarios, subtitle: 'Usuarios con acceso', icon: <UserCheck size={19} /> },
    { title: 'Roles', value: 4, subtitle: 'Empleado, RRHH, Líder, Admin', icon: <ShieldCheck size={19} /> },
    { title: 'Pendientes', value: demoMode ? 0 : proyectos.filter((p) => p.estado === 'BORRADOR').length, subtitle: 'Proyectos por iniciar', icon: <Clock3 size={19} /> },
  ]

  const actividades = demoMode ? DEMO_ACTIVIDADES : []
  const termino = busquedaSuperior.trim().toLocaleLowerCase('es')
  const actividadesVisibles = actividades.filter(item =>
    [item.tipo, item.nombre, item.fecha, item.estado].join(' ').toLocaleLowerCase('es').includes(termino))
  const usuariosVisibles = (demoMode ? DEMO_USUARIOS : usuarios).filter(item =>
    [item.nombre, item.email, item.rol, item.estado].join(' ').toLocaleLowerCase('es').includes(termino)).slice(0, 3)

  const quickActions = [
    { label: 'Gestionar usuarios', onClick: () => navigate('/usuarios') },
    { label: 'Gestionar colaboradores', onClick: () => navigate('/colaboradores') },
    { label: 'Gestionar proyectos', onClick: () => navigate('/proyectos') },
  ]

  return (
    <div className="emp-dashboard admin-dashboard-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
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
              value={busquedaSuperior} onChange={evento => setBusquedaSuperior(evento.target.value)} />
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
    ) : error ? (
      <div className="admin-dashboard-error" role="alert">
        <span style={{ fontSize: '3rem' }}>⚠</span>
        <p>{error}</p>
        <Button variant="outline" onClick={loadDashboardData}>Reintentar</Button>
      </div>
    ) : (
      <>
        <div className="admin-dashboard-statistics"><Statistics stats={stats} /></div>

        <div className="admin-dashboard-columns">
          <div className="admin-dashboard-panel admin-dashboard-activity">
            <ActivityList activities={actividadesVisibles} />
          </div>

          <div className="card-section">
            <div className="card-section-header">
              <h2 className="card-section-title">Usuarios recientes</h2>
            </div>
            <div className="card-section-body">
              {usuariosVisibles.length > 0 ? (
                <>
                  {usuariosVisibles.map((u) => (
                    <div key={u.usuarioId} className="admin-dashboard-user-row">
                      <div>
                        <p className="admin-dashboard-user-name">{u.nombre}</p>
                        <p className="admin-dashboard-user-email">{u.email}</p>
                      </div>
                      <div className="admin-dashboard-user-meta">
                        <span className={'admin-dashboard-role' + (u.rol === 'ADMINISTRADOR' || u.rol === 'RRHH' ? ' manager' : '')}>{u.rol}</span>
                        <p className={'admin-dashboard-user-state' + (u.estado === 'ACTIVO' ? ' active' : '')}>{u.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <EmptyState message="No hay usuarios recientes" icon="👥" />
              )}
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
                Utilice el menú lateral para navegar a Usuarios, Colaboradores o Proyectos.
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