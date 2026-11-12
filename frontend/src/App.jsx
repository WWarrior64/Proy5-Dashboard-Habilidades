import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx'

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
import Habilidades from './pages/Habilidades.jsx'
import Asignaciones from './pages/Asignaciones.jsx'
import EmpleadoAsignaciones from './pages/EmpleadoAsignaciones.jsx'
import Postulaciones from './pages/Postulaciones.jsx'
import EmpleadoPostulaciones from './pages/EmpleadoPostulaciones.jsx'
import Usuarios from './pages/Usuarios.jsx'
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
  return user?.rol === 'RRHH' ? <Colaboradores /> : <MainLayout />
}

// Conserva la pantalla de gestión de proyectos para el resto de roles.
function ProyectosPorRol() {
  const { user } = useAuth()
  return user?.rol === 'EMPLEADO' ? <EmpleadoProyectos /> : <MainLayout />
}

// La vista anterior de postulaciones permanece accesible para otros roles.
function PostulacionesPorRol() {
  const { user } = useAuth()
  return user?.rol === 'EMPLEADO' ? <EmpleadoPostulaciones /> : <MainLayout />
}

// La vista original de asignaciones sigue disponible para los demás roles.
function AsignacionesPorRol() {
  const { user } = useAuth()
  return user?.rol === 'EMPLEADO' ? <EmpleadoAsignaciones /> : <MainLayout />
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
            <Route path="dashboards/lider" element={<LiderProyectoDashboard />} />
            <Route path="dashboards/administrador" element={<AdministradorDashboard />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="perfil" element={<Perfil />} />
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
          <Route path="/habilidades" element={<ProtectedRoute><Habilidades /></ProtectedRoute>} />
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