import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx'

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
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboards/empleado" replace />} />
            <Route path="dashboards/empleado" element={<EmpleadoDashboard />} />
            <Route path="dashboards/rrhh" element={<RecursosHumanosDashboard />} />
            <Route path="dashboards/lider" element={<LiderProyectoDashboard />} />
            <Route path="dashboards/administrador" element={<AdministradorDashboard />} />
            <Route path="colaboradores" element={<Colaboradores />} />
            <Route path="proyectos" element={<Proyectos />} />
            <Route path="habilidades" element={<Habilidades />} />
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