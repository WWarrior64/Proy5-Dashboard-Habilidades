import { Link, useLocation } from 'react-router-dom'
import { Menu, Home, Users, Briefcase, BadgePercent, ClipboardList, FileText, ShieldAlert, LogOut } from 'lucide-react'

const navItems = [
  { path: '/dashboards/empleado', label: 'Inicio', icon: Home },
  { path: '/colaboradores', label: 'Colaboradores', icon: Users },
  { path: '/proyectos', label: 'Proyectos', icon: Briefcase },
  { path: '/habilidades', label: 'Habilidades', icon: BadgePercent },
  { path: '/asignaciones', label: 'Asignaciones', icon: ClipboardList },
  { path: '/postulaciones', label: 'Postulaciones', icon: FileText },
  { path: '/usuarios', label: 'Usuarios', icon: ShieldAlert },
  { path: '/perfil', label: 'Perfil', icon: FileText },
]

export default function Sidebar({ user, onLogout }) {
  const location = useLocation()
  const { hasPermission, canManage } = usePermissionsHook()
  return (
    <aside className="w-64 bg-[#0f172a] text-[#e2e8f0] flex flex-col shrink-0 hidden md:flex">
      <div className="p-5 flex items-center gap-2 border-b border-[#1e293b]">
        <BadgePercent size={24} strokeWidth={2} className="text-[#2563eb]" />
        <span className="font-bold text-lg tracking-tight">Internal<span className="text-[#2563eb]">Market</span></span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const canAccess = canManage() || ['ver_perfil', 'ver_colaboradores', 'ver_proyectos', 'postularse'].includes(item.label.toLowerCase())
          if (!canAccess && item.path !== '/perfil') return null
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                active ? 'bg-[#2563eb] text-white' : 'hover:bg-[#334155] text-[#cbd5e1]'
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-[#1e293b]">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-lg text-sm text-[#ef4444] hover:bg-[#450a0a] transition">
          <LogOut size={18} strokeWidth={2} />
          Cerrar sesión
        </button>
        <p className="mt-3 text-xs text-[#64748b]">{user?.rol || 'Usuario'}</p>
      </div>
    </aside>
  )
}

function usePermissionsHook() {
  const mod = require('../hooks/usePermissions.js')
  return { hasPermission: mod.hasPermission, canManage: mod.canManage }
}