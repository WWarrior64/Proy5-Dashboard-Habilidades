import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BriefcaseBusiness, CheckCircle2, Clock3, UserRound, UsersRound } from 'lucide-react'
import EmpleadoLogoutButton from '../../components/layout/EmpleadoLogoutButton.jsx'
import { colaboradoresService } from '../../services/colaboradores.service.js'
import { habilidadesService } from '../../services/habilidades.service.js'
import { usuariosService } from '../../services/usuarios.service.js'
import { cargosService } from '../../services/cargos.service.js'
import GestionCargosModal from '../../components/cargos/GestionCargosModal.jsx'
import { proyectosService } from '../../services/proyectos.service.js'
import { asignacionesService } from '../../services/asignaciones.service.js'
import { extractItems } from '../../utils/apiResponses.js'
import { getApiErrorMessage } from '../../utils/apiErrors.js'
import './recursos-humanos-dashboard.css'

// Resumen de demostración: los valores sirven para revisar el diseño del dashboard.
// No representan estadísticas verificadas del backend.
const resumenEjemplo = {
  colaboradores: 35,
  disponibles: 13,
  proyectosActivos: 8,
  asignaciones: 22,
}

const colaboradoresRecientes = [
  { id: 1, nombre: 'Valeria Cruz', cargo: 'Ingeniera Cloud', ingreso: '02/11/2026', disponibilidad: 'Disponible', clase: 'disponible' },
  { id: 2, nombre: 'Diego Rivas', cargo: 'Desarrollador Móvil', ingreso: '28/10/2026', disponibilidad: 'Parcial', clase: 'parcial' },
  { id: 3, nombre: 'Camila Ortiz', cargo: 'Analista de datos', ingreso: '15/10/2026', disponibilidad: 'No disponible', clase: 'no-disponible' },
]

const talentoPorCargo = [
  { id: 1, nombre: 'Desarrollo Backend', colaboradores: 12 },
  { id: 2, nombre: 'Frontend', colaboradores: 9 },
  { id: 3, nombre: 'Cloud', colaboradores: 6 },
  { id: 4, nombre: 'Otros cargos', colaboradores: 8 },
]

const habilidadesMasUsadas = [
  { id: 1, nombre: 'SQL', categoria: 'Bases de datos', colaboradores: 14 },
  { id: 2, nombre: 'React', categoria: 'Frontend', colaboradores: 12 },
  { id: 3, nombre: 'Node.js', categoria: 'Backend', colaboradores: 10 },
]

const menu = [
  ['Dashboard', '/dashboards/rrhh'],
  ['Colaboradores', '/colaboradores'],
  ['Habilidades', '/habilidades'],
  ['Proyectos', '/proyectos'],
  ['Asignaciones', '/asignaciones'],
]

const modoDemo = import.meta.env.VITE_DEMO_MODE === 'true'
const fechaVisible = valor => valor ? new Date(valor).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '—'

export default function RecursosHumanosDashboard() {
  const [resumen, setResumen] = useState(modoDemo ? resumenEjemplo : null)
  const [recientes, setRecientes] = useState(modoDemo ? colaboradoresRecientes : [])
  const [cargos, setCargos] = useState(modoDemo ? talentoPorCargo : [])
  const [habilidades, setHabilidades] = useState(modoDemo ? habilidadesMasUsadas : [])
  const [cargando, setCargando] = useState(!modoDemo)
  const [error, setError] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [cargosAbierto, setCargosAbierto] = useState(false)
  const [versionCargos, setVersionCargos] = useState(0)

  useEffect(() => {
    if (modoDemo) return undefined
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        const [colaboradoresResp, proyectosResp, asignacionesResp, usuariosResp, cargosResp, habilidadesResp] = await Promise.all([
          colaboradoresService.listAll(),
          proyectosService.list({ estado: 'ACTIVO' }),
          asignacionesService.list(),
          usuariosService.listAll(),
          cargosService.list({ estado: 'ACTIVO', limit: 100 }),
          habilidadesService.listAll(),
        ])
        const colaboradores = extractItems(colaboradoresResp.data)
        const proyectos = extractItems(proyectosResp.data)
        const asignaciones = extractItems(asignacionesResp.data)
        const usuarios = new Map(extractItems(usuariosResp.data).map(item => [item.usuarioId, item.nombre]))
        const cargosCatalogo = new Map(extractItems(cargosResp.data).map(item => [item.cargoId, item.nombre]))
        const habilidadesCatalogo = new Map(extractItems(habilidadesResp.data).map(item => [item.habilidadId, item]))
        const resultadosHabilidades = await Promise.allSettled(colaboradores.map(item =>
          colaboradoresService.listSkills(item.colaboradorId)))
        if (resultadosHabilidades.some(item => item.status === 'rejected')) {
          throw new Error('No se pudieron consultar todas las habilidades de los colaboradores.')
        }
        const cantidadesHabilidades = new Map()
        resultadosHabilidades.forEach(result => {
          const ids = new Set(extractItems(result.value.data).map(item => item.habilidadId))
          ids.forEach(id => cantidadesHabilidades.set(id, (cantidadesHabilidades.get(id) || 0) + 1))
        })
        const cargoConteos = new Map()
        colaboradores.filter(item => item.estado === 'ACTIVO').forEach(item => {
          const nombre = cargosCatalogo.get(item.cargoId) || item.rolProfesional || 'Sin cargo'
          cargoConteos.set(nombre, (cargoConteos.get(nombre) || 0) + 1)
        })
        const disponibilidad = item => {
          if (item.estado !== 'ACTIVO') return { nombre: 'Inactivo', clase: 'no-disponible' }
          if (!Number.isFinite(item.dedicacionReservada)) return { nombre: 'Sin datos', clase: 'no-disponible' }
          if (item.dedicacionReservada === 0) return { nombre: 'Disponible', clase: 'disponible' }
          if (item.dedicacionReservada < 100) return { nombre: 'Parcial', clase: 'parcial' }
          return { nombre: 'No disponible', clase: 'no-disponible' }
        }
        const recientes = colaboradores.filter(item => item.estado === 'ACTIVO').sort((a, b) =>
          (b.fechaAlta || '').localeCompare(a.fechaAlta || '')).slice(0, 3).map(item => {
            const estado = disponibilidad(item)
            return {
              id: item.colaboradorId,
              nombre: usuarios.get(item.usuarioId) || item.nombre || 'Sin nombre registrado',
              cargo: cargosCatalogo.get(item.cargoId) || item.rolProfesional || 'Sin cargo',
              ingreso: fechaVisible(item.fechaAlta),
              disponibilidad: estado.nombre,
              clase: estado.clase,
            }
          })
        if (!cancelado) {
          setResumen({
            colaboradores: colaboradores.length,
            disponibles: colaboradores.filter(item =>
              item.estado === 'ACTIVO' && Number.isFinite(item.dedicacionReservada) && item.dedicacionReservada < 100).length,
            proyectosActivos: proyectos.length,
            asignaciones: asignaciones.filter(item => item.estado === 'ACTIVA').length,
          })
          setRecientes(recientes)
          setCargos([...cargoConteos].sort((a, b) => b[1] - a[1]).map(([nombre, colaboradores], i) =>
            ({ id: i, nombre, colaboradores })))
          setHabilidades([...cantidadesHabilidades]
             .filter(([id]) => habilidadesCatalogo.get(id)?.estado !== 'INACTIVO')
             .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, cantidad]) => ({
            id,
            nombre: habilidadesCatalogo.get(id)?.nombre || id,
            categoria: habilidadesCatalogo.get(id)?.categoria || 'Sin categoría',
            colaboradores: cantidad,
          })))
        }
      } catch (fallo) {
        if (!cancelado) setError(getApiErrorMessage(fallo, 'No se pudo cargar el dashboard de RRHH.'))
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [versionCargos])

  const termino = busquedaSuperior.trim().toLocaleLowerCase('es')
  const recientesVisibles = useMemo(() => recientes.filter(item =>
    [item.nombre, item.cargo, item.disponibilidad].join(' ').toLocaleLowerCase('es').includes(termino)
  ), [recientes, termino])
  const cargosVisibles = useMemo(() => cargos.filter(item =>
    item.nombre.toLocaleLowerCase('es').includes(termino)
  ), [cargos, termino])
  const habilidadesVisibles = useMemo(() => habilidades.filter(item =>
    [item.nombre, item.categoria].join(' ').toLocaleLowerCase('es').includes(termino)
  ), [habilidades, termino])

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
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content rrhh-dashboard-content" aria-labelledby="rrhh-dashboard-title">
          <div className="rrhh-dashboard-intro">
            <h2 id="rrhh-dashboard-title" className="rrhh-dashboard-section-title">Resumen general</h2>
            <span className="rrhh-dashboard-preview">{modoDemo ? 'Datos de ejemplo' : cargando ? 'Cargando...' : 'Datos reales'}</span>
            {error && <p role="alert">{error}</p>}
          </div>

          <div className="rrhh-dashboard-metrics">
            <div className="emp-card rrhh-dashboard-metric">
              <div className="rrhh-dashboard-metric-text">
                <p className="emp-card-label">Colaboradores</p>
                <p className="emp-card-value">{resumen?.colaboradores ?? '—'}</p>
                <p className="rrhh-dashboard-metric-note">Plantilla registrada</p>
              </div>
              <span className="rrhh-dashboard-metric-icon"><UsersRound size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card rrhh-dashboard-metric">
              <div className="rrhh-dashboard-metric-text">
                <p className="emp-card-label">Disponibles</p>
                <p className="emp-card-value">{resumen?.disponibles ?? '—'}</p>
                <p className="rrhh-dashboard-metric-note">Con capacidad</p>
              </div>
              <span className="rrhh-dashboard-metric-icon"><CheckCircle2 size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card rrhh-dashboard-metric">
              <div className="rrhh-dashboard-metric-text">
                <p className="emp-card-label">Proyectos activos</p>
                <p className="emp-card-value">{resumen?.proyectosActivos ?? '—'}</p>
                <p className="rrhh-dashboard-metric-note">En ejecución</p>
              </div>
              <span className="rrhh-dashboard-metric-icon"><BriefcaseBusiness size={19} aria-hidden="true" /></span>
            </div>
            <div className="emp-card rrhh-dashboard-metric">
              <div className="rrhh-dashboard-metric-text">
                <p className="emp-card-label">Asignaciones</p>
                <p className="emp-card-value">{resumen?.asignaciones ?? '—'}</p>
                <p className="rrhh-dashboard-metric-note">Vigentes</p>
              </div>
              <span className="rrhh-dashboard-metric-icon"><Clock3 size={19} aria-hidden="true" /></span>
            </div>
          </div>

          <div className="rrhh-dashboard-panels">
            <section className="rrhh-dashboard-panel" aria-labelledby="rrhh-recientes-titulo">
              <h2 id="rrhh-recientes-titulo">Colaboradores recientes</h2>
              <div className="rrhh-dashboard-panel-list">
                {recientesVisibles.map(item => (
                  <Link to="/colaboradores" className="rrhh-dashboard-row rrhh-dashboard-person" key={item.id}>
                    <div className="rrhh-dashboard-row-copy">
                      <strong>{item.nombre}</strong>
                      <p>{item.cargo} · Ingreso {item.ingreso}</p>
                    </div>
                    <span className={'rrhh-dashboard-status ' + item.clase}>{item.disponibilidad}</span>
                  </Link>
                ))}
                {!recientesVisibles.length && <p className="rrhh-dashboard-empty">No hay colaboradores que coincidan con la búsqueda.</p>}
              </div>
            </section>

            <section className="rrhh-dashboard-panel" aria-labelledby="rrhh-cargos-titulo">
              <h2 id="rrhh-cargos-titulo">Talento por cargo</h2>
              <div className="rrhh-dashboard-panel-list">
                {cargosVisibles.map(item => {
                  const porcentaje = resumen?.colaboradores ? Math.round(item.colaboradores / resumen.colaboradores * 100) : 0
                  return (
                    <div className="rrhh-dashboard-row rrhh-dashboard-cargo" key={item.id}>
                      <div className="rrhh-dashboard-row-copy">
                        <strong>{item.nombre}</strong>
                        <p>{item.colaboradores} colaboradores</p>
                      </div>
                      <div className="rrhh-dashboard-progress-column">
                        <div className="rrhh-dashboard-progress" role="progressbar"
                          aria-label={'Porcentaje de ' + item.nombre} aria-valuemin={0} aria-valuemax={100}
                          aria-valuenow={porcentaje}>
                          <span style={{ width: porcentaje + '%' }} />
                        </div>
                        <span>{porcentaje} %</span>
                      </div>
                    </div>
                  )
                })}
                {!cargosVisibles.length && <p className="rrhh-dashboard-empty">No hay cargos que coincidan con la búsqueda.</p>}
              </div>
            </section>

            <section className="rrhh-dashboard-panel rrhh-dashboard-actions-panel" aria-labelledby="rrhh-acciones-titulo">
              <h2 id="rrhh-acciones-titulo">Acciones rápidas</h2>
              <div className="rrhh-dashboard-quick-actions">
                <Link to="/colaboradores">Gestionar colaboradores</Link>
                <button type="button" onClick={() => setCargosAbierto(true)}>Gestionar cargos</button>
                <Link to="/habilidades">Gestionar habilidades</Link>
              </div>

            </section>

            <section className="rrhh-dashboard-panel" aria-labelledby="rrhh-habilidades-titulo">
              <h2 id="rrhh-habilidades-titulo">Habilidades más usadas</h2>
              <div className="rrhh-dashboard-panel-list">
                {habilidadesVisibles.map(item => (
                  <Link to="/habilidades" className="rrhh-dashboard-row rrhh-dashboard-skill" key={item.id}>
                    <div className="rrhh-dashboard-row-copy">
                      <strong>{item.nombre}</strong>
                      <p>{item.categoria}</p>
                    </div>
                    <span className="rrhh-dashboard-skill-count">{item.colaboradores} colaboradores</span>
                  </Link>
                ))}
                {!habilidadesVisibles.length && <p className="rrhh-dashboard-empty">No hay habilidades que coincidan con la búsqueda.</p>}
              </div>
            </section>
          </div>
        </section>
      </main>
      <GestionCargosModal abierto={cargosAbierto} onClose={() => setCargosAbierto(false)}
        onUpdated={() => setVersionCargos(v => v + 1)} />
    </div>
  )
}