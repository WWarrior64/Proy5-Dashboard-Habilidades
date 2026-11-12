import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Search, UserRound } from 'lucide-react'
import EmpleadoLogoutButton from '../../components/layout/EmpleadoLogoutButton.jsx'
import './recursos-humanos-dashboard.css'

// Información de ejemplo para diseñar la vista; sustituir por datos del backend.
const colaboradores = [
  { id: 1, nombre: 'Ana López', area: 'Desarrollo frontend', habilidad: 'React', disponible: true },
  { id: 2, nombre: 'Carlos Ruiz', area: 'Desarrollo backend', habilidad: 'Node.js', disponible: true },
  { id: 3, nombre: 'Sofía Gómez', area: 'Diseño UX/UI', habilidad: 'Figma', disponible: true },
  { id: 4, nombre: 'Luis Pérez', area: 'Análisis de datos', habilidad: 'SQL', disponible: false },
  { id: 5, nombre: 'María Torres', area: 'Cloud', habilidad: 'AWS', disponible: true },
  { id: 6, nombre: 'Diego Ramírez', area: 'Calidad de software', habilidad: 'Pruebas', disponible: true },
  { id: 7, nombre: 'Valeria Morales', area: 'Desarrollo frontend', habilidad: 'JavaScript', disponible: true },
  { id: 8, nombre: 'Andrés Vega', area: 'Desarrollo móvil', habilidad: 'Flutter', disponible: false },
  { id: 9, nombre: 'Lucía Hernández', area: 'Seguridad', habilidad: 'OAuth', disponible: true },
  { id: 10, nombre: 'Martín Castro', area: 'DevOps', habilidad: 'Docker', disponible: true },
]

// Estas cifras son únicamente ilustrativas hasta disponer de los endpoints de resumen.
const resumenEjemplo = { proyectosActivos: 10, asignaciones: 10 }

const menu = [
  ['Dashboard', '/dashboards/rrhh'],
  ['Colaboradores', '/colaboradores'],
  ['Habilidades', '/habilidades'],
  ['Proyectos', '/proyectos'],
  ['Asignaciones', '/asignaciones'],
]

export default function RecursosHumanosDashboard() {
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [busquedaTabla, setBusquedaTabla] = useState('')
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState('Todos')

  const visibles = useMemo(() => {
    const terminos = [busquedaSuperior, busquedaTabla].map(valor => valor.trim().toLocaleLowerCase('es'))
    return colaboradores.filter(colaborador => {
      const contenido = [colaborador.nombre, colaborador.area, colaborador.habilidad].join(' ').toLocaleLowerCase('es')
      return terminos.every(termino => contenido.includes(termino)) &&
        (filtroDisponibilidad === 'Todos' || (filtroDisponibilidad === 'Disponibles' ? colaborador.disponible : !colaborador.disponible))
    })
  }, [busquedaSuperior, busquedaTabla, filtroDisponibilidad])

  const disponibles = colaboradores.filter(colaborador => colaborador.disponible).length

  return (
    <div className="emp-dashboard rrhh-dashboard">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de recursos humanos">
            {menu.map(([nombre, ruta]) => (
              <NavLink
                key={ruta}
                to={ruta}
                end
                className={({ isActive }) => 'emp-sidebar-item' + (isActive ? ' active' : '')}
              >
                {nombre}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="emp-sidebar-bottom">
          <span className="emp-sidebar-user">RRHH</span>
          <EmpleadoLogoutButton />
        </div>
      </aside>

      <main className="emp-main">
        <header className="emp-header">
          <h1 className="emp-header-title">Dashboard de talento</h1>
          <div className="emp-header-right">
            <input
              className="emp-search"
              type="search"
              placeholder="Buscar..."
              aria-label="Buscar colaboradores desde el encabezado"
              value={busquedaSuperior}
              onChange={evento => setBusquedaSuperior(evento.target.value)}
            />
            <div className="emp-user-icon" aria-label="Perfil de RRHH">
              <UserRound size={22} aria-hidden="true" />
            </div>
          </div>
        </header>

        <section className="emp-content rrhh-dashboard-content" aria-labelledby="rrhh-dashboard-title">
          <h2 id="rrhh-dashboard-title" className="rrhh-dashboard-section-title">Resumen general</h2>
          <div className="rrhh-dashboard-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Colaboradores</p>
              <p className="emp-card-value">{colaboradores.length}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Disponibles</p>
              <p className="emp-card-value">{disponibles}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Proyectos activos</p>
              <p className="emp-card-value">{resumenEjemplo.proyectosActivos}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Asignaciones</p>
              <p className="emp-card-value">{resumenEjemplo.asignaciones}</p>
            </div>
          </div>

          <section className="rrhh-talent-panel" aria-labelledby="rrhh-talent-title">
            <div className="rrhh-talent-heading">
              <h3 id="rrhh-talent-title">Resumen de talento</h3>
              <div className="rrhh-talent-actions">
                <label className="rrhh-talent-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Buscar..."
                    aria-label="Buscar en resumen de talento"
                    value={busquedaTabla}
                    onChange={evento => setBusquedaTabla(evento.target.value)}
                  />
                </label>
                <select
                  className="rrhh-talent-filter-select"
                  aria-label="Filtrar colaboradores por disponibilidad"
                  value={filtroDisponibilidad}
                  onChange={evento => setFiltroDisponibilidad(evento.target.value)}
                >
                  <option value="Todos">Todos</option>
                  <option value="Disponibles">Disponibles</option>
                  <option value="No disponibles">No disponibles</option>
                </select>
              </div>
            </div>

            <div className="rrhh-talent-scroll">
              <table className="rrhh-talent-table">
                <thead>
                  <tr>
                    <th>Área / Rol</th>
                    <th>Colaboradores</th>
                    <th>Habilidad</th>
                    <th>Disponibilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(colaborador => (
                    <tr key={colaborador.id}>
                      <td>{colaborador.area}</td>
                      <td>{colaborador.nombre}</td>
                      <td>{colaborador.habilidad}</td>
                      <td>
                        <span className={'rrhh-talent-status ' + (colaborador.disponible ? 'available' : 'unavailable')}>
                          {colaborador.disponible ? 'Disponible' : 'No disponible'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibles.length === 0 && (
                <p className="rrhh-talent-empty">No se encontraron colaboradores con esos filtros.</p>
              )}
            </div>
            <p className="rrhh-talent-count">
              Mostrando {visibles.length} de {colaboradores.length} colaboradores
            </p>
          </section>
        </section>
      </main>
    </div>
  )
}