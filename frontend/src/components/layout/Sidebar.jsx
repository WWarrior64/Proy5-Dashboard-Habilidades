import { Link, useLocation } from 'react-router-dom'
import { Home, Users, Briefcase, BadgePercent, ClipboardList, FileText, ShieldAlert, Search, LogOut } from 'lucide-react'
import { usePermissions } from '../../hooks/usePermissions.js'
import { ROUTE_PATHS, ROLES } from '../../utils/constants.js'

const ALL_NAV_ITEMS = [
  { path: ROUTE_PATHS.DASHBOARD_ADMIN, label: 'Resumen', icon: Home, permission: null },
  { path: ROUTE_PATHS.USUARIOS, label: 'Usuarios', icon: ShieldAlert, permission: 'consultar_usuarios' },
  { path: ROUTE_PATHS.COLABORADORES, label: 'Colaboradores', icon: Users, permission: 'consultar_colaboradores' },
  { path: ROUTE_PATHS.PROYECTOS, label: 'Proyectos', icon: Briefcase, permission: 'consultar_proyectos' },
  { path: ROUTE_PATHS.HABILIDADES, label: 'Habilidades', icon: BadgePercent, permission: 'consultar_habilidades' },
  { path: ROUTE_PATHS.CARGOS, label: 'Cargos', icon: ClipboardList, permission: 'consultar_cargos' },
  { path: ROUTE_PATHS.BUSQUEDA, label: 'Búsqueda', icon: Search, permission: 'buscar_candidatos' },
  { path: ROUTE_PATHS.ASIGNACIONES, label: 'Asignaciones', icon: ClipboardList, permission: 'consultar_asignaciones' },
  { path: ROUTE_PATHS.POSTULACIONES, label: 'Postulaciones', icon: FileText, permission: 'consultar_postulaciones' },
  { path: ROUTE_PATHS.PERFIL, label: 'Perfil', icon: FileText, permission: null },
]

export default function Sidebar({ user, onLogout }) {
  const location = useLocation()
  const { hasPermission } = usePermissions()
  const isAdmin = user?.rol === ROLES.ADMINISTRADOR
  const isRRHH = user?.rol === ROLES.RRHH

  // Filtrar módulos visibles por rol: RRHH y ADMINISTRADOR ven todos los módulos de gestión
  const visibleItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.permission) return true
    if (!hasPermission(item.permission)) return false
    return true
  })

  return (
    <aside className="w-64" style={{ backgroundColor: 'var(--color-sidebar)', color: '#e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div className="p-5 flex items-center gap-2 border-b" style={{ borderColor: '#1e293b' }}>
        <BadgePercent size={24} strokeWidth={2} className="text-[#2563eb]" />
        <span className="font-bold text-lg tracking-tight">Internal<span style={{ color: '#2563eb' }}>Market</span></span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const canAccess = !item.permission || hasPermission(item.permission) || item.path === ROUTE_PATHS.PERFIL
          if (!canAccess) return null
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition"
              style={{
                backgroundColor: active ? '#2563eb' : 'transparent',
                color: active ? '#ffffff' : '#cbd5e1',
                borderRight: active ? '3px solid #1d4ed8' : 'none',
              }}
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t" style={{ borderColor: '#1e293b' }}>
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-lg text-sm" style={{ color: '#ef4444' }}>
          <LogOut size={18} strokeWidth={2} />
          Cerrar sesión
        </button>
        <p className="mt-3 text-xs" style={{ color: '#64748b' }}>{user?.rol || 'Usuario'}</p>
      </div>
    </aside>
  )
}