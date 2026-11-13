import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx'
import { ROLES, ROUTE_PATHS } from './utils/constants.js'

// Pages
import Login from './pages/Login.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import NotFound from './pages/NotFound.jsx'
import EmpleadoDashboard from './pages/dashboards/EmpleadoDashboard.jsx'
import RecursosHumanosDashboard from './pages/dashboards/RecursosHumanosDashboard.jsx'
import LiderProyectoDashboard from './pages/dashboards/LiderProyectoDashboard.jsx'
import AdministradorDashboard from './pages/dashboards/AdministradorDashboard.jsx'
import Colaboradores from './pages/Colaboradores.jsx'
import Proyectos from './pages/Proyectos.jsx'
import EmpleadoProyectos from './pages/EmpleadoProyectos.jsx'
import LiderProyectosVista from './pages/LiderProyectosVista.jsx'
import LiderBuscarTalentoVista from './pages/LiderBuscarTalentoVista.jsx'
import Habilidades from './pages/Habilidades.jsx'
import RrhhHabilidadesVista from './pages/RrhhHabilidadesVista.jsx'
import Asignaciones from './pages/Asignaciones.jsx'
import RrhhAsignacionesVista from './pages/RrhhAsignacionesVista.jsx'
import LiderAsignacionesVista from './pages/LiderAsignacionesVista.jsx'
import EmpleadoAsignaciones from './pages/EmpleadoAsignaciones.jsx'
import Postulaciones from './pages/Postulaciones.jsx'
import EmpleadoPostulaciones from './pages/EmpleadoPostulaciones.jsx'
import LiderPostulacionesVista from './pages/LiderPostulacionesVista.jsx'
import AdministradorUsuariosVista from './pages/AdministradorUsuariosVista.jsx'
import AdministradorRolesPermisosVista from './pages/AdministradorRolesPermisosVista.jsx'
import AdministradorConfiguracionVista from './pages/AdministradorConfiguracionVista.jsx'
import AdministradorAuditoriaVista from './pages/AdministradorAuditoriaVista.jsx'
import Perfil from './pages/Perfil.jsx'

// Layout
import MainLayout from './components/layout/MainLayout.jsx'

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

// Para RRHH, Colaboradores usa su propio diseño de tarjetas y barra lateral.
function ColaboradoresPorRol() {
  const { user } = useAuth()
  return user?.rol === 'RRHH' ? <Colaboradores />
    : user?.rol === 'LIDER_PROYECTO' ? <LiderBuscarTalentoVista /> : <MainLayout />
}

// Conserva la pantalla de gestión de proyectos para el resto de roles.
function ProyectosPorRol() {
  const { user } = useAuth()
  return user?.rol === 'EMPLEADO' ? <EmpleadoProyectos />
    : user?.rol === 'RRHH' ? <Proyectos />
      : user?.rol === 'LIDER_PROYECTO' ? <LiderProyectosVista /> : <MainLayout />
}

// La vista anterior de postulaciones permanece accesible para otros roles.
function PostulacionesPorRol() {
  const { user } = useAuth()
  return user?.rol === 'EMPLEADO' ? <EmpleadoPostulaciones />
    : user?.rol === 'LIDER_PROYECTO' ? <LiderPostulacionesVista /> : <MainLayout />
}

// La vista original de asignaciones sigue disponible para los demás roles.
function AsignacionesPorRol() {
  const { user } = useAuth()
  return user?.rol === 'EMPLEADO' ? <EmpleadoAsignaciones />
    : user?.rol === 'RRHH' ? <RrhhAsignacionesVista />
      : user?.rol === 'LIDER_PROYECTO' ? <LiderAsignacionesVista /> : <MainLayout />
}

function HabilidadesPorRol() {
  const { user } = useAuth()
  return user?.rol === 'RRHH' ? <RrhhHabilidadesVista /> : <Habilidades />
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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Login />} />
          </Route>
          <Route element={<ProtectedRoute><ColaboradoresPorRol /></ProtectedRoute>}>
            <Route path="colaboradores" element={<Colaboradores />} />
          </Route>
          <Route element={<ProtectedRoute><ProyectosPorRol /></ProtectedRoute>}>
            <Route path="proyectos" element={<Proyectos />} />
          </Route>
          <Route element={<ProtectedRoute><PostulacionesPorRol /></ProtectedRoute>}>
            <Route path="postulaciones" element={<Postulaciones />} />
          </Route>
          <Route element={<ProtectedRoute><AsignacionesPorRol /></ProtectedRoute>}>
            <Route path="asignaciones" element={<Asignaciones />} />
          </Route>
          <Route path="/habilidades" element={<ProtectedRoute><HabilidadesPorRol /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><AdministradorUsuariosVista /></ProtectedRoute>} />
          <Route path="/roles-permisos" element={<ProtectedRoute><AdministradorRolesPermisosVista /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute><AdministradorConfiguracionVista /></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute><AdministradorAuditoriaVista /></ProtectedRoute>} />
          <Route path="/dashboards/administrador" element={<ProtectedRoute><AdministradorDashboard /></ProtectedRoute>} />
          <Route path="/dashboards/lider" element={<ProtectedRoute><LiderProyectoDashboard /></ProtectedRoute>} />
          <Route path="/dashboards/rrhh" element={
            <ProtectedRoute>
              <RecursosHumanosDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboards/empleado" element={
            <ProtectedRoute>
              <EmpleadoDashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App