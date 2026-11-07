import { Link, useLocation } from 'react-router-dom'
import { Home, Users, Briefcase, BadgePercent, ClipboardList, FileText, ShieldAlert, LogOut } from 'lucide-react'
import { usePermissions } from '../../hooks/usePermissions.js'

const navItems = [
  { path: '/dashboards/administrador', label: 'Resumen', icon: Home },
  { path: '/usuarios', label: 'Usuarios', icon: ShieldAlert },
  { path: '/colaboradores', label: 'Colaboradores', icon: Users },
  { path: '/proyectos', label: 'Proyectos', icon: Briefcase },
  { path: '/perfil', label: 'Perfil', icon: FileText },
]

const ROUTE_PERMISSION_MAP = {
  '/dashboards/administrador': 'ver_usuarios',
  '/usuarios': 'ver_usuarios',
  '/colaboradores': 'ver_colaboradores',
  '/proyectos': 'ver_proyectos',
  '/perfil': 'ver_perfil',
}

export default function Sidebar({ user, onLogout }) {
  const location = useLocation()
  const { hasPermission } = usePermissions()

  return (
    <aside className="w-64" style={{ backgroundColor: 'var(--color-sidebar)', color: '#e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div className="p-5 flex items-center gap-2 border-b" style={{ borderColor: '#1e293b' }}>
        <BadgePercent size={24} strokeWidth={2} className="text-[#2563eb]" />
        <span className="font-bold text-lg tracking-tight">Internal<span style={{ color: '#2563eb' }}>Market</span></span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const requiredPermission = ROUTE_PERMISSION_MAP[item.path]
          const canAccess = !requiredPermission || hasPermission(requiredPermission) || item.path === '/perfil'
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