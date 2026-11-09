import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx'
import { ROLES, ROUTE_PATHS } from './utils/constants.js'

// Pages
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import EmpleadoDashboard from './pages/dashboards/EmpleadoDashboard.jsx'
import RecursosHumanosDashboard from './pages/dashboards/RecursosHumanosDashboard.jsx'
import LiderProyectoDashboard from './pages/dashboards/LiderProyectoDashboard.jsx'
import AdministradorDashboard from './pages/dashboards/AdministradorDashboard.jsx'
import Colaboradores from './pages/Colaboradores.jsx'
import Proyectos from './pages/Proyectos.jsx'
import Habilidades from './pages/Habilidades.jsx'
import Asignaciones from './pages/Asignaciones.jsx'
import Postulaciones from './pages/Postulaciones.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Perfil from './pages/Perfil.jsx'

// Layout
import MainLayout from './components/layout/MainLayout.jsx'

const DASHBOARD_BY_ROLE = {
  [ROLES_ADMIN.ADMINISTRADOR]: ROUTE_PATHS.DASHBOARD_ADMIN,
  [ROLES_ADMIN.RRHH]: ROUTE_PATHS.DASHBOARD_RRHH,
  [ROLES_ADMIN.LIDER_PROYECTO]: ROUTE_PATHS.DASHBOARD_LIDER,
  [ROLES_ADMIN.EMPLEADO]: ROUTE_PATHS.DASHBOARD_EMPLEADO,
}

function PublicRoute({ component: Component, ...rest }) {
  return (
    <Routes>
      <Route
        {...rest}
        element={
          <>
            <Component {...rest} />
          </>
        }
      />
    </Routes>
  )
}

function RedirectByRole() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to={ROUTE_PATHS.LOGIN} replace />
  }

  const target = DASHBOARD_BY_ROLE[user.rol] || ROUTE_PATHS.DASHBOARD_EMPLEADO
  // Evitar redirección infinita si ya estamos en el dashboard correcto
  if (location.pathname === target) return null
  return <Navigate to={target} replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Redirección inicial según rol */}
          <Route path="/" element={<RedirectByRole />} />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboards/empleado" element={<EmpleadoDashboard />} />
            <Route path="dashboards/rrhh" element={<RecursosHumanosDashboard />} />
            <Route path="dashboards/lider" element={<LiderProyectoDashboard />} />
            <Route path="dashboards/administrador" element={<AdministradorDashboard />} />
            <Route path="colaboradores" element={<Colaboradores />} />
            <Route path="proyectos" element={<Proyectos />} />
            <Route path="habilidades" element={<Habilidades />} />
            <Route path="cargos" element={<Navigate to="/dashboards/administrador" replace />} />
            <Route path="busqueda" element={<Navigate to="/dashboards/lider" replace />} />
            <Route path="asignaciones" element={<Asignaciones />} />
            <Route path="postulaciones" element={<Postulaciones />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App