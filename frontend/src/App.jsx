import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

const inicioPorRol = {
  [ROLES.EMPLEADO]: ROUTE_PATHS.DASHBOARD_EMPLEADO,
  [ROLES.RRHH]: ROUTE_PATHS.DASHBOARD_RRHH,
  [ROLES.LIDER_PROYECTO]: ROUTE_PATHS.DASHBOARD_LIDER,
  [ROLES.ADMINISTRADOR]: ROUTE_PATHS.DASHBOARD_ADMIN,
}

function InicioPorRol() {
  const { user } = useAuth()
  return <Navigate to={inicioPorRol[user?.rol] || '/login'} replace />
}

// La autorización visual es independiente del ProtectedRoute y de la seguridad del backend.
function SoloRol({ permitidos, children }) {
  const { user } = useAuth()
  return user && !permitidos.includes(user.rol) ? <Navigate to="/" replace /> : children
}

// Para RRHH, Colaboradores usa su propio diseño de tarjetas y barra lateral.
function ColaboradoresPorRol() {
  const { user } = useAuth()
  return [ROLES.RRHH, ROLES.ADMINISTRADOR].includes(user?.rol) ? <Colaboradores />
    : user?.rol === ROLES.LIDER_PROYECTO ? <LiderBuscarTalentoVista /> : <MainLayout />
}

// Conserva la pantalla de gestión de proyectos para el resto de roles.
function ProyectosPorRol() {
  const { user } = useAuth()
  return user?.rol === 'EMPLEADO' ? <EmpleadoProyectos />
    : [ROLES.RRHH, ROLES.ADMINISTRADOR].includes(user?.rol) ? <Proyectos />
      : user?.rol === ROLES.LIDER_PROYECTO ? <LiderProyectosVista /> : <MainLayout />
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
            <Route path="/" element={<InicioPorRol />} />
          </Route>
          <Route element={<ProtectedRoute><SoloRol permitidos={[ROLES.RRHH, ROLES.LIDER_PROYECTO, ROLES.ADMINISTRADOR]}><ColaboradoresPorRol /></SoloRol></ProtectedRoute>}>
            <Route path="colaboradores" element={<Colaboradores />} />
          </Route>
          <Route element={<ProtectedRoute><SoloRol permitidos={[ROLES.EMPLEADO, ROLES.RRHH, ROLES.LIDER_PROYECTO, ROLES.ADMINISTRADOR]}><ProyectosPorRol /></SoloRol></ProtectedRoute>}>
            <Route path="proyectos" element={<Proyectos />} />
          </Route>
          <Route element={<ProtectedRoute><SoloRol permitidos={[ROLES.EMPLEADO, ROLES.LIDER_PROYECTO]}><PostulacionesPorRol /></SoloRol></ProtectedRoute>}>
            <Route path="postulaciones" element={<Postulaciones />} />
          </Route>
          <Route element={<ProtectedRoute><SoloRol permitidos={[ROLES.EMPLEADO, ROLES.RRHH, ROLES.LIDER_PROYECTO]}><AsignacionesPorRol /></SoloRol></ProtectedRoute>}>
            <Route path="asignaciones" element={<Asignaciones />} />
          </Route>
          <Route path="/habilidades" element={<ProtectedRoute><SoloRol permitidos={[ROLES.EMPLEADO, ROLES.RRHH]}><HabilidadesPorRol /></SoloRol></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><SoloRol permitidos={[ROLES.ADMINISTRADOR]}><AdministradorUsuariosVista /></SoloRol></ProtectedRoute>} />
          <Route path="/roles-permisos" element={<ProtectedRoute><SoloRol permitidos={[ROLES.ADMINISTRADOR]}><AdministradorRolesPermisosVista /></SoloRol></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute><SoloRol permitidos={[ROLES.ADMINISTRADOR]}><AdministradorConfiguracionVista /></SoloRol></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute><SoloRol permitidos={[ROLES.ADMINISTRADOR]}><AdministradorAuditoriaVista /></SoloRol></ProtectedRoute>} />
          <Route path="/dashboards/administrador" element={<ProtectedRoute><SoloRol permitidos={[ROLES.ADMINISTRADOR]}><AdministradorDashboard /></SoloRol></ProtectedRoute>} />
          <Route path="/dashboards/lider" element={<ProtectedRoute><SoloRol permitidos={[ROLES.LIDER_PROYECTO]}><LiderProyectoDashboard /></SoloRol></ProtectedRoute>} />
          <Route path="/dashboards/rrhh" element={
            <ProtectedRoute>
              <SoloRol permitidos={[ROLES.RRHH]}><RecursosHumanosDashboard /></SoloRol>
            </ProtectedRoute>
          } />
          <Route path="/dashboards/empleado" element={
            <ProtectedRoute>
              <SoloRol permitidos={[ROLES.EMPLEADO]}><EmpleadoDashboard /></SoloRol>
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App