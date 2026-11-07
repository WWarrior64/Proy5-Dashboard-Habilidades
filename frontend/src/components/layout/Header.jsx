import { Link } from 'react-router-dom'
import { Bell, Sun, Moon, Menu as MenuIcon } from 'lucide-react'

export default function Header({ user }) {
  return (
    <header className="h-16 bg-[#ffffff] border-b border-[#e2e8f0] flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button className="md:hidden p-2 text-[#64748b] hover:text-[#172554]">
          <MenuIcon size={22} strokeWidth={2} />
        </button>
        <Link to="/" className="flex items-center gap-2 font-bold text-[#172554]">
          <div className="w-6 h-6 rounded bg-[#2563eb] flex items-center justify-center text-xs text-white">IM</div>
          <span className="hidden sm:inline">Internal Marketplace</span>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 text-[#64748b] hover:text-[#172554]"><Bell size={20} strokeWidth={2} /></button>
        <button className="p-2 text-[#64748b] hover:text-[#172554]"><Sun size={20} strokeWidth={2} /></button>
        <div className="flex items-center gap-2 pl-2 border-l border-[#e2e8f0]">
          <div className="hidden sm:flex flex-col items-end text-right">
            <p className="text-sm font-semibold text-[#172554]">{user?.nombre || 'Usuario'}</p>
            <p className="text-xs text-[#64748b] capitalize">{user?.rol || ''}</p>
          </div>
          <img
            src="https://ui-avatars.com/api/?name=Usuario&background=2563eb&color=fff"
            alt="avatar"
            className="w-8 h-8 rounded-full border border-[#e2e8f0]"
          />
        </div>
      </div>
    </header>
  )
}