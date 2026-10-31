import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import Footer from './Footer.jsx'

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} onLogout={() => { logout(); navigate('/login') }} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 sm:p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}