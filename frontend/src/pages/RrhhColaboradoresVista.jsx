import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { habilidadesService } from '../services/habilidades.service.js'
import './rrhh-colaboradores.css'

const menu = [
  ['Dashboard', '/dashboards/rrhh'],
  ['Colaboradores', '/colaboradores'],
  ['Habilidades', '/habilidades'],
  ['Proyectos', '/proyectos'],
  ['Asignaciones', '/asignaciones'],
]

// Tarjeta exclusivamente visual en desarrollo: nunca se envía al backend.
const ejemploInactivo = {
  colaboradorId: '__vista_previa_inactivo__',
  nombre: 'Ejemplo inactivo',
  rolProfesional: 'Backend',
  habilidades: ['SQL', 'Node', 'Mongo', 'Docker'],
  nivel: 'Junior',
  disponibilidad: 'ASIGNADA',
  estado: 'INACTIVO',
  esEjemplo: true,
}

function nombreColaborador(colaborador, usuarios) {
  const usuario = usuarios.find(item => item.usuarioId === colaborador.usuarioId)
  return usuario?.nombre || colaborador.nombre || colaborador.usuarioId || 'Colaborador'
}

function nivelColaborador(colaborador) {
  if (colaborador.nivel) return String(colaborador.nivel)
  const niveles = Array.isArray(colaborador.habilidades)
    ? colaborador.habilidades.filter(item => typeof item === 'object' && item?.nivel).map(item => item.nivel)
    : []
  return niveles[0] || 'Sin especificar'
}

function habilidadesColaborador(colaborador) {
  if (!Array.isArray(colaborador.habilidades)) return []
  return colaborador.habilidades.map(item => {
    if (typeof item === 'string') return item
    return item?.nombre || item?.habilidad?.nombre || item?.habilidadId || ''
  }).filter(Boolean)
}

function rolResumido(rol) {
  if (/front[\s-]?end/i.test(rol)) return 'Frontend'
  if (/back[\s-]?end/i.test(rol)) return 'Backend'
  return rol
}

function iniciales(nombre) {
  return nombre.trim().split(/\s+/).slice(0, 2).map(palabra => palabra.charAt(0)).join('').toUpperCase()
}

export default function RrhhColaboradoresVista({
  colaboradores,
  usuarios,
  cargos,
  loading,
  error,
  canManage,
  onCreate,
  onEdit,
  onRemove,
  onDetails,
  onRetry,
}) {
  const [busqueda, setBusqueda] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [disponibilidad, setDisponibilidad] = useState('Todas')
  const [habilidadesPorColaborador, setHabilidadesPorColaborador] = useState({})

  // La lista de colaboradores no incluye siempre habilidades y niveles.
  // Completar esos datos desde las relaciones existentes en el backend.
  useEffect(() => {
    const pendientes = colaboradores.filter(item => !Array.isArray(item.habilidades) || !item.habilidades.length)
    if (!pendientes.length) {
      setHabilidadesPorColaborador({})
      return
    }
    let cancelado = false
    const cargar = async () => {
      const [catalogo, relaciones] = await Promise.all([
        habilidadesService.list({ limit: 100 })
          .then(response => {
            const datos = response.data?.datos
            return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
          })
          .catch(() => []),
        Promise.allSettled(pendientes.map(item => colaboradoresService.listSkills(item.colaboradorId))),
      ])
      const nombres = new Map(catalogo.map(item => [item.habilidadId, item.nombre]))
      const asociadas = {}
      pendientes.forEach((item, indice) => {
        const resultado = relaciones[indice]
        if (resultado.status !== 'fulfilled') return
        const datos = resultado.value.data?.datos
        const filas = Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
        asociadas[item.colaboradorId] = filas.map(habilidad => ({
          ...habilidad,
          nombre: nombres.get(habilidad.habilidadId) || habilidad.habilidadId,
        }))
      })
      if (!cancelado) setHabilidadesPorColaborador(asociadas)
    }
    cargar()
    return () => { cancelado = true }
  }, [colaboradores])

  const colaboradoresConHabilidades = useMemo(() => colaboradores.map(item => {
    const habilidades = habilidadesPorColaborador[item.colaboradorId]
    return habilidades?.length ? { ...item, habilidades } : item
  }), [colaboradores, habilidadesPorColaborador])

  const hayInactivoReal = colaboradores.some(item => (
    item.estado === 'INACTIVO' ||
    usuarios.some(usuario => usuario.usuarioId === item.usuarioId && usuario.estado === 'INACTIVO')
  ))
  const hayVistaRealDeHabilidades = colaboradoresConHabilidades.some(item => habilidadesColaborador(item).length >= 3)
  const mostrarEjemploInactivo = import.meta.env.DEV && (!hayInactivoReal || !hayVistaRealDeHabilidades)
  const tarjetas = mostrarEjemploInactivo
    ? [...colaboradoresConHabilidades, ejemploInactivo]
    : colaboradoresConHabilidades

  const colaboradoresVisibles = useMemo(() => {
    const terminos = [busqueda, busquedaSuperior].map(texto => texto.trim().toLocaleLowerCase('es'))
    return tarjetas.filter(colaborador => {
      const nombre = nombreColaborador(colaborador, usuarios)
      const cargo = cargos.find(item => item.cargoId === colaborador.cargoId)
      const habilidades = habilidadesColaborador(colaborador)
      const texto = [nombre, colaborador.rolProfesional, cargo?.nombre, ...habilidades]
        .filter(Boolean).join(' ').toLocaleLowerCase('es')
      const estado = (colaborador.disponibilidad || 'DISPONIBLE').toUpperCase()
      return terminos.every(termino => texto.includes(termino)) &&
        (disponibilidad === 'Todas' ||
          (disponibilidad === 'Disponibles' && estado === 'DISPONIBLE') ||
          (disponibilidad === 'Asignados' && estado === 'ASIGNADA'))
    })
  }, [tarjetas, usuarios, cargos, busqueda, busquedaSuperior, disponibilidad])

  const disponibles = colaboradores.filter(item => (item.disponibilidad || 'DISPONIBLE') === 'DISPONIBLE').length
  const asignados = colaboradores.filter(item => item.disponibilidad === 'ASIGNADA').length

  return (
    <div className="emp-dashboard rrhh-colaboradores-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de recursos humanos">
            {menu.map(([texto, ruta]) => (
              <NavLink
                key={ruta}
                to={ruta}
                end
                className={({ isActive }) => 'emp-sidebar-item' + (isActive ? ' active' : '')}
              >{texto}</NavLink>
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
          <h1 className="emp-header-title">Colaboradores</h1>
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

        <section className="emp-content rrhh-colaboradores-content" aria-labelledby="rrhh-colaboradores-title">
          <div className="rrhh-colaboradores-heading">
            <h2 id="rrhh-colaboradores-title">Colaboradores</h2>
            {canManage && (
              <button
                type="button"
                className="rrhh-colaboradores-add"
                onClick={onCreate}
                disabled={loading}
              >
                <Plus size={16} aria-hidden="true" />
                Registrar colaborador
              </button>
            )}
          </div>

          <div className="rrhh-colaboradores-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Total colaboradores</p>
              <p className="emp-card-value">{colaboradores.length}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Disponibles</p>
              <p className="emp-card-value">{disponibles}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Asignados</p>
              <p className="emp-card-value">{asignados}</p>
            </div>
          </div>

          <section className="rrhh-colaboradores-panel" aria-labelledby="rrhh-listado-title">
            <div className="rrhh-colaboradores-panel-header">
              <h3 id="rrhh-listado-title">Listado de colaboradores</h3>
              <div className="rrhh-colaboradores-filters">
                <label className="rrhh-colaboradores-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Buscar colaborador..."
                    aria-label="Buscar colaborador por nombre, rol o habilidad"
                    value={busqueda}
                    onChange={evento => setBusqueda(evento.target.value)}
                  />
                </label>
                <select
                  aria-label="Filtrar por disponibilidad"
                  value={disponibilidad}
                  onChange={evento => setDisponibilidad(evento.target.value)}
                >
                  <option value="Todas">Disponibilidad: Todas</option>
                  <option value="Disponibles">Disponibles</option>
                  <option value="Asignados">Asignados</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="rrhh-colaboradores-feedback" role="alert">
                <p>{error}</p>
                <button className="rrhh-colaboradores-retry" type="button" onClick={onRetry}>Reintentar</button>
              </div>
            )}
            {loading ? (
              <p className="rrhh-colaboradores-feedback" role="status">Cargando colaboradores...</p>
            ) : colaboradoresVisibles.length ? (
              <div className="rrhh-colaboradores-grid">
                {colaboradoresVisibles.map(colaborador => {
                  const nombre = nombreColaborador(colaborador, usuarios)
                  const cargo = cargos.find(item => item.cargoId === colaborador.cargoId)
                  const rol = colaborador.rolProfesional || cargo?.nombre || 'Sin rol registrado'
                  const nivel = nivelColaborador(colaborador)
                  const habilidades = habilidadesColaborador(colaborador)
                  const usuario = usuarios.find(item => item.usuarioId === colaborador.usuarioId)
                  const estaActivo = colaborador.estado !== 'INACTIVO' && usuario?.estado !== 'INACTIVO'
                  const yaDadoDeBaja = colaborador.estado === 'INACTIVO'
                  const estadoDisponibilidad = (colaborador.disponibilidad || 'DISPONIBLE').toUpperCase()
                  const disponible = estadoDisponibilidad === 'DISPONIBLE'
                  return (
                    <article className="rrhh-colaborador-card" key={colaborador.colaboradorId}>
                      <div className="rrhh-colaborador-top">
                        <div className="rrhh-colaborador-avatar" aria-hidden="true">{iniciales(nombre)}</div>
                        <div className="rrhh-colaborador-identity">
                          <h4 title={nombre}>{nombre}</h4>
                          <p title={rol + ' | ' + nivel}>
                            {rolResumido(rol)} <span aria-hidden="true">|</span> {nivel === 'Sin especificar' ? 'Sin nivel' : nivel.charAt(0).toUpperCase() + nivel.slice(1).toLowerCase()}
                          </p>
                        </div>
                        <div className="rrhh-colaborador-estados">
                        <span className={'rrhh-colaborador-status ' + (disponible ? 'disponible' : 'asignada')}>
                          {disponible ? 'Disponible' : estadoDisponibilidad === 'ASIGNADA' ? 'Asignado' : 'No disponible'}
                        </span>
                        <span className={'rrhh-colaborador-status ' + (estaActivo ? 'activo' : 'inactivo')}>
                          {estaActivo ? 'Activo' : 'Inactivo'}
                        </span>
                        </div>
                      </div>

                      <div className="rrhh-colaborador-info">
                        <div className="rrhh-colaborador-skills">
                          <span>Habilidades</span>
                          <div className="rrhh-colaborador-chips">
                            {habilidades.length ? habilidades.slice(0, 3).map((habilidad, index) => (
                              <span className="rrhh-colaborador-chip" key={habilidad + index}>{habilidad}</span>
                            )) : <span className="rrhh-colaborador-unknown">Sin habilidades registradas</span>}
                            {habilidades.length > 3 && (
                              <span className="rrhh-colaborador-chip" title={habilidades.slice(3).join(', ')} aria-label={habilidades.length - 3 + ' habilidades adicionales'}>...</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rrhh-colaborador-footer">
                        <button
                          type="button"
                          className="rrhh-colaborador-detail-button"
                          onClick={() => onDetails(colaborador)}
                        >
                          Ver perfil
                        </button>
                        {canManage && (
                          <div className="rrhh-colaborador-actions">
                            <button
                              type="button"
                              onClick={() => onEdit(colaborador)}
                              aria-label={'Editar ' + nombre}
                              title={colaborador.esEjemplo ? 'Vista previa: no se puede editar' : 'Editar ' + nombre}
                              disabled={loading || colaborador.esEjemplo}
                            ><Pencil size={16} aria-hidden="true" /></button>
                            <button
                              type="button"
                              className="rrhh-colaborador-remove"
                              onClick={() => onRemove(colaborador)}
                              aria-label={'Eliminar colaborador ' + nombre}
                              title={colaborador.esEjemplo ? 'Vista previa: no se puede eliminar' : yaDadoDeBaja ? 'El perfil ya está dado de baja' : 'Eliminar colaborador ' + nombre}
                              disabled={loading || colaborador.esEjemplo || yaDadoDeBaja}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                      {colaborador.esEjemplo && (
                        <p className="rrhh-colaborador-inactive">Vista previa · datos ficticios, sin cambios en el backend</p>
                      )}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="rrhh-colaboradores-feedback">
                {colaboradores.length ? 'No hay colaboradores que coincidan con los filtros.' : 'No hay colaboradores registrados.'}
              </p>
            )}

            {!loading && !error && (
              <p className="rrhh-colaboradores-count">
                Mostrando {colaboradoresVisibles.filter(item => !item.esEjemplo).length} de {colaboradores.length} colaboradores
                {colaboradoresVisibles.some(item => item.esEjemplo) && ' · 1 tarjeta de ejemplo'}
              </p>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}
