import { useState } from 'react'
import { NavLink } from 'react-router-dom'

export default function EmpleadoDashboard() {
  const [searchHeader, setSearchHeader] = useState('')
  const [searchTable, setSearchTable] = useState('')

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', to: '/dashboards/empleado' },
    { key: 'habilidades', label: 'Mis habilidades', to: '/habilidades' },
    { key: 'proyectos', label: 'Proyectos disponibles', to: '/proyectos' },
    { key: 'postulaciones', label: 'Mis postulaciones', to: '/postulaciones' },
    { key: 'asignaciones', label: 'Mis asignaciones', to: '/asignaciones' },
  ]

  const rows = [
    { proyecto: 'Nombre', habilidades: 'Habilidades', horas: '999', estado: 'Disponible' },
    { proyecto: 'Nombre', habilidades: 'Habilidades', horas: '999', estado: 'No disponible' },
    { proyecto: 'Nombre', habilidades: 'Habilidades', horas: '999', estado: 'Disponible' },
  ]

  return (
    <div className="emp-dashboard">
      {/* Sidebar */}
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">
            INTERNAL<br />MARKETPLACE
          </div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu">
            {menuItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  'emp-sidebar-item' + (isActive ? ' active' : '')
                }
                end={item.key === 'dashboard'}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="emp-sidebar-bottom">
          <div className="emp-sidebar-user">Empleado</div>
        </div>
      </aside>

      {/* Main area */}
      <main className="emp-main">
        {/* Header */}
        <header className="emp-header">
          <h1 className="emp-header-title">Dashboard</h1>
          <div className="emp-header-right">
            <input
              type="text"
              className="emp-search"
              placeholder="Buscar..."
              value={searchHeader}
              onChange={(e) => setSearchHeader(e.target.value)}
            />
            <div className="emp-user-icon">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" />
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              </svg>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="emp-content">
          {/* Metrics cards */}
          <div className="emp-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Habilidades registradas</p>
              <p className="emp-card-value">10</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Proyectos disponibles</p>
              <p className="emp-card-value">10</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Postulaciones</p>
              <p className="emp-card-value">10</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Asignaciones</p>
              <p className="emp-card-value">10</p>
            </div>
          </div>

          {/* Table panel */}
          <div className="emp-table-panel">
            <div className="emp-table-header">
              <h2 className="emp-table-title">Oportunidades recomendadas</h2>
              <div className="emp-table-actions">
                <input
                  type="text"
                  className="emp-search"
                  placeholder="Buscar..."
                  value={searchTable}
                  onChange={(e) => setSearchTable(e.target.value)}
                />
                <div className="emp-filter-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2m0 0 2 2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 0L3 7" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="emp-table-body">
              <table className="emp-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Proyectos</th>
                    <th style={{ width: '30%' }}>Habilidades clave</th>
                    <th style={{ width: '25%' }}>Horas</th>
                    <th style={{ width: '20%' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td>{row.proyecto}</td>
                      <td>{row.habilidades}</td>
                      <td>{row.horas}</td>
                      <td>
                        <span
                          className={`emp-status ${
                            row.estado === 'Disponible'
                              ? 'available'
                              : 'unavailable'
                          }`}
                        >
                          {row.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}