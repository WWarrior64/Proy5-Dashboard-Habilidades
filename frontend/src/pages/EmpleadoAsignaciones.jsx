import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Eye, Search, UserRound, X } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import './empleado-asignaciones.css'

// Datos de ejemplo para el prototipo; no representan asignaciones del backend.
const asignacionesIniciales = [
  {
    id: 1,
    proyecto: 'Portal de clientes',
    lider: 'Luis Pérez',
    dedicacion: 40,
    horasCompletadas: 12,
    horasAsignadas: 40,
    fechaInicio: '01/11/2026',
    fechaFin: '15/12/2026',
    estado: 'Activa',
  },
  {
    id: 2,
    proyecto: 'Sistema Web',
    lider: 'Sofía Ramírez',
    dedicacion: 20,
    horasCompletadas: 8,
    horasAsignadas: 30,
    fechaInicio: '25/10/2026',
    fechaFin: '30/11/2026',
    estado: 'Activa',
  },
]

const menu = [
  ['Dashboard', '/dashboards/empleado'],
  ['Mis habilidades', '/habilidades'],
  ['Proyectos disponibles', '/proyectos'],
  ['Mis postulaciones', '/postulaciones'],
  ['Mis asignaciones', '/asignaciones'],
]

const estilosEstado = {
  Activa: 'activa',
  Finalizada: 'finalizada',
  Desvinculada: 'desvinculada',
}

export default function EmpleadoAsignaciones() {
  const [busqueda, setBusqueda] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [estado, setEstado] = useState('Todos')
  const [detalle, setDetalle] = useState(null)

  const visibles = useMemo(() => {
    const terminos = [busqueda, busquedaSuperior].map(valor => valor.trim().toLocaleLowerCase('es'))
    return asignacionesIniciales.filter(asignacion => {
      const contenido = [asignacion.proyecto, asignacion.lider].join(' ').toLocaleLowerCase('es')
      return terminos.every(termino => contenido.includes(termino)) &&
        (estado === 'Todos' || asignacion.estado === estado)
    })
  }, [busqueda, busquedaSuperior, estado])

  const activas = asignacionesIniciales.filter(item => item.estado === 'Activa')
  const dedicacionTotal = activas.reduce((suma, item) => suma + item.dedicacion, 0)
  const horasAsignadas = activas.reduce((suma, item) => suma + item.horasAsignadas, 0)
  const horasCompletadas = activas.reduce((suma, item) => suma + item.horasCompletadas, 0)

  return (
    <div className="emp-dashboard emp-assignments-page">
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
          <h1 className="emp-header-title">Mis asignaciones</h1>
          <div className="emp-header-right">
            <input
              type="search"
              className="emp-search"
              aria-label="Buscar asignaciones desde el encabezado"
              placeholder="Buscar..."
              value={busquedaSuperior}
              onChange={evento => setBusquedaSuperior(evento.target.value)}
            />
            <div className="emp-user-icon" aria-label="Perfil de empleado">
              <UserRound size={22} aria-hidden="true" />
            </div>
          </div>
        </header>

        <section className="emp-content emp-assignments-content" aria-labelledby="assignments-title">
          <h2 className="emp-assignments-title" id="assignments-title">Mis asignaciones</h2>

          <div className="emp-assignments-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Asignaciones activas</p>
              <p className="emp-card-value">{activas.length}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Dedicación total</p>
              <p className="emp-card-value">{dedicacionTotal} %</p>
              <div
                className="emp-assignments-meter"
                role="progressbar"
                aria-label="Dedicación total"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(dedicacionTotal, 100)}
              >
                <span style={{ width: Math.min(dedicacionTotal, 100) + '%' }} />
              </div>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Horas asignadas</p>
              <p className="emp-card-value">{horasAsignadas}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Horas completadas</p>
              <p className="emp-card-value">{horasCompletadas}</p>
            </div>
          </div>

          <div className="emp-assignments-filters">
            <label className="emp-assignments-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar proyecto o líder"
                placeholder="Buscar proyecto o líder..."
                value={busqueda}
                onChange={evento => setBusqueda(evento.target.value)}
              />
            </label>
            <select
              value={estado}
              onChange={evento => setEstado(evento.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="Todos">Estado: Todos</option>
              <option value="Activa">Activa</option>
              <option value="Finalizada">Finalizada</option>
              <option value="Desvinculada">Desvinculada</option>
            </select>
          </div>

          <div className="emp-assignments-table-panel">
            <div className="emp-assignments-table-scroll">
              <table className="emp-assignments-table">
                <thead>
                  <tr>
                    <th>Proyecto</th>
                    <th>Líder</th>
                    <th>Dedicación</th>
                    <th>Horas completadas / asignadas</th>
                    <th>Fecha de inicio</th>
                    <th>Fecha de fin</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(asignacion => (
                    <tr key={asignacion.id}>
                      <td>{asignacion.proyecto}</td>
                      <td>{asignacion.lider}</td>
                      <td>
                        <div className="emp-assignments-progress-label">{asignacion.dedicacion} %</div>
                        <div className="emp-assignments-meter emp-assignments-row-meter"
                          role="progressbar"
                          aria-label={'Dedicación de ' + asignacion.proyecto}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={asignacion.dedicacion}
                        >
                          <span style={{ width: asignacion.dedicacion + '%' }} />
                        </div>
                      </td>
                      <td>
                        <div className="emp-assignments-progress-label">
                          {asignacion.horasCompletadas} / {asignacion.horasAsignadas} h
                        </div>
                        <div className="emp-assignments-meter emp-assignments-row-meter"
                          role="progressbar"
                          aria-label={'Horas completadas de ' + asignacion.proyecto}
                          aria-valuemin={0}
                          aria-valuemax={asignacion.horasAsignadas}
                          aria-valuenow={asignacion.horasCompletadas}
                        >
                          <span style={{ width: (asignacion.horasCompletadas / asignacion.horasAsignadas) * 100 + '%' }} />
                        </div>
                      </td>
                      <td>{asignacion.fechaInicio}</td>
                      <td>{asignacion.fechaFin}</td>
                      <td>
                        <span className={'emp-assignments-status ' + estilosEstado[asignacion.estado]}>
                          {asignacion.estado}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="emp-assignments-view"
                          aria-label={'Ver detalles de ' + asignacion.proyecto}
                          title={'Ver detalles de ' + asignacion.proyecto}
                          onClick={() => setDetalle(asignacion)}
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibles.length === 0 && (
                <p className="emp-assignments-empty">No se encontraron asignaciones con esos filtros.</p>
              )}
            </div>
            <p className="emp-assignments-count">
              Mostrando {visibles.length} de {asignacionesIniciales.length} asignaciones
            </p>
          </div>
        </section>
      </main>

      {detalle && (
        <div className="emp-assignments-backdrop" onMouseDown={evento => {
          if (evento.target === evento.currentTarget) setDetalle(null)
        }}>
          <section className="emp-assignments-dialog" role="dialog" aria-modal="true" aria-labelledby="assignment-detail-title">
            <div className="emp-assignments-dialog-heading">
              <h2 id="assignment-detail-title">Detalle de asignación</h2>
              <button type="button" onClick={() => setDetalle(null)} aria-label="Cerrar">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <dl>
              <dt>Proyecto</dt><dd>{detalle.proyecto}</dd>
              <dt>Líder</dt><dd>{detalle.lider}</dd>
              <dt>Dedicación</dt><dd>{detalle.dedicacion} %</dd>
              <dt>Horas completadas</dt><dd>{detalle.horasCompletadas} de {detalle.horasAsignadas} h</dd>
              <dt>Fecha de inicio</dt><dd>{detalle.fechaInicio}</dd>
              <dt>Fecha de fin</dt><dd>{detalle.fechaFin}</dd>
              <dt>Estado</dt>
              <dd><span className={'emp-assignments-status ' + estilosEstado[detalle.estado]}>{detalle.estado}</span></dd>
            </dl>
            <button type="button" className="emp-assignments-close" onClick={() => setDetalle(null)}>Cerrar</button>
          </section>
        </div>
      )}
    </div>
  )
}
