import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Filter, Search, UserRound } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import './empleado-proyectos.css'

// Datos de demostración hasta conectar la vista con el backend.
const proyectosIniciales = [
  {
    id: 1,
    nombre: 'Portal de clientes',
    lider: 'Sofía Gómez',
    habilidades: ['React · Mid', 'SQL · Mid'],
    horas: 80,
    fechas: '09/11–18/12/2026',
    coincidencia: 92,
  },
  {
    id: 2,
    nombre: 'API empresarial',
    lider: 'Martín Pérez',
    habilidades: ['Node.js · Mid', 'AWS · Junior'],
    horas: 60,
    fechas: '16/11–11/12/2026',
    coincidencia: 78,
  },
  {
    id: 3,
    nombre: 'App móvil',
    lider: 'Laura Torres',
    habilidades: ['Flutter · Mid'],
    horas: 100,
    fechas: '23/11–29/01/2027',
    coincidencia: 35,
  },
]

const menu = [
  ['Dashboard', '/dashboards/empleado'],
  ['Mis habilidades', '/habilidades'],
  ['Proyectos disponibles', '/proyectos'],
  ['Mis postulaciones', '/postulaciones'],
  ['Mis asignaciones', '/asignaciones'],
]

export default function EmpleadoProyectos() {
  const [busqueda, setBusqueda] = useState('')
  const [busquedaEncabezado, setBusquedaEncabezado] = useState('')
  const [soloAltaCoincidencia, setSoloAltaCoincidencia] = useState(false)
  const [postulados, setPostulados] = useState([2])

  const proyectosFiltrados = useMemo(() => {
    const buscar = texto => texto.toLocaleLowerCase('es')
    return proyectosIniciales.filter(proyecto => {
      const contenido = buscar([proyecto.nombre, proyecto.lider, ...proyecto.habilidades].join(' '))
      return contenido.includes(buscar(busqueda.trim())) &&
        contenido.includes(buscar(busquedaEncabezado.trim())) &&
        (!soloAltaCoincidencia || proyecto.coincidencia >= 70)
    })
  }, [busqueda, busquedaEncabezado, soloAltaCoincidencia])

  const coincidenciasAltas = proyectosIniciales.filter(proyecto => proyecto.coincidencia >= 70).length

  const postularme = id => {
    setPostulados(actuales => actuales.includes(id) ? actuales : [...actuales, id])
  }

  return (
    <div className="emp-dashboard emp-projects-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de empleado">
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
          <div className="emp-sidebar-user">Empleado</div>
          <EmpleadoLogoutButton />
        </div>
      </aside>

      <main className="emp-main">
        <header className="emp-header">
          <h1 className="emp-header-title">Proyectos disponibles</h1>
          <div className="emp-header-right">
            <input
              className="emp-search"
              type="search"
              aria-label="Buscar proyectos desde el encabezado"
              placeholder="Buscar..."
              value={busquedaEncabezado}
              onChange={evento => setBusquedaEncabezado(evento.target.value)}
            />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content emp-projects-content" aria-labelledby="emp-projects-title">
          <div className="emp-projects-intro">
            <h2 id="emp-projects-title">Proyectos disponibles</h2>
          </div>

          <div className="emp-projects-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Proyectos disponibles</p>
              <p className="emp-card-value">{proyectosIniciales.length}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Con alta coincidencia</p>
              <p className="emp-card-value">{coincidenciasAltas}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Postulaciones enviadas</p>
              <p className="emp-card-value">{postulados.length}</p>
            </div>
          </div>

          <div className="emp-projects-filters">
            <h3>Filtros</h3>
            <div className="emp-projects-filter-controls">
              <label className="emp-projects-search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Buscar proyectos"
                  placeholder="Buscar proyecto..."
                  value={busqueda}
                  onChange={evento => setBusqueda(evento.target.value)}
                />
              </label>
              <button
                type="button"
                className={'emp-projects-filter-button' + (soloAltaCoincidencia ? ' is-active' : '')}
                title={soloAltaCoincidencia ? 'Mostrar todos los proyectos' : 'Mostrar solo proyectos con alta coincidencia'}
                aria-label={soloAltaCoincidencia ? 'Mostrar todos los proyectos' : 'Filtrar por alta coincidencia'}
                aria-pressed={soloAltaCoincidencia}
                onClick={() => setSoloAltaCoincidencia(actual => !actual)}
              >
                <Filter size={19} aria-hidden="true" />
              </button>
              {soloAltaCoincidencia && <span className="emp-projects-filter-note">Alta coincidencia</span>}
            </div>
          </div>

          <div className="emp-projects-table-panel">
            <div className="emp-projects-table-scroll">
              <table className="emp-projects-table">
                <thead>
                  <tr>
                    <th>Proyecto</th>
                    <th>Líder</th>
                    <th>Habilidades requeridas</th>
                    <th>Horas</th>
                    <th>Fechas</th>
                    <th>Tu coincidencia</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {proyectosFiltrados.map(proyecto => {
                    const alta = proyecto.coincidencia >= 70
                    const postulado = postulados.includes(proyecto.id)
                    return (
                      <tr key={proyecto.id}>
                        <td className="emp-projects-name">
                          <strong>{proyecto.nombre}</strong>
                          <span>Activo</span>
                        </td>
                        <td>{proyecto.lider}</td>
                        <td>
                          <div className="emp-projects-tags">
                            {proyecto.habilidades.map(habilidad => (
                              <span key={habilidad} className="emp-projects-tag">{habilidad}</span>
                            ))}
                          </div>
                        </td>
                        <td>{proyecto.horas} h</td>
                        <td>{proyecto.fechas}</td>
                        <td>
                          <div className="emp-projects-match-label">
                            <strong>{proyecto.coincidencia}%</strong>
                            <span>{alta ? 'Alta' : 'Baja'}</span>
                          </div>
                          <div
                            className="emp-projects-match-track"
                            role="progressbar"
                            aria-label={'Coincidencia para ' + proyecto.nombre}
                            aria-valuenow={proyecto.coincidencia}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <span style={{ width: proyecto.coincidencia + '%' }} />
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={'emp-projects-apply' + (postulado ? ' is-applied' : '')}
                            disabled={postulado}
                            onClick={() => postularme(proyecto.id)}
                          >
                            {postulado ? 'En revisión' : 'Postularme'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {proyectosFiltrados.length === 0 && (
                <p className="emp-projects-empty">No se encontraron proyectos con estos filtros.</p>
              )}
            </div>
            <p className="emp-projects-total">
              Mostrando {proyectosFiltrados.length} de {proyectosIniciales.length} proyectos
            </p>
          </div>
          <p className="emp-projects-footnote">* Habilidad obligatoria · El nivel indicado es el mínimo requerido</p>
        </section>
      </main>
    </div>
  )
}
