import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Pencil, Plus, Search, UserRound, X } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { habilidadesService } from '../services/habilidades.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import './rrhh-habilidades.css'

const menu = [
  ['Dashboard', '/dashboards/rrhh'],
  ['Colaboradores', '/colaboradores'],
  ['Habilidades', '/habilidades'],
  ['Proyectos', '/proyectos'],
  ['Asignaciones', '/asignaciones'],
]

const categoriasBase = [
  { value: 'FRONTEND', label: 'Frontend' },
  { value: 'BACKEND', label: 'Backend' },
  { value: 'BASES_DE_DATOS', label: 'Bases de datos' },
  { value: 'CLOUD', label: 'Cloud' },
]

const ejemploCatalogo = [
  { habilidadId: 'ejemplo-react', nombre: 'React', categoria: 'FRONTEND', descripcion: 'Biblioteca para interfaces web', colaboradores: 12, proyectos: 3, estado: 'ACTIVO' },
  { habilidadId: 'ejemplo-node', nombre: 'Node.js', categoria: 'BACKEND', descripcion: 'Entorno de ejecución para APIs', colaboradores: 10, proyectos: 2, estado: 'ACTIVO' },
  { habilidadId: 'ejemplo-sql', nombre: 'SQL', categoria: 'BASES_DE_DATOS', descripcion: 'Consultas y diseño de bases relacionales', colaboradores: 14, proyectos: 3, estado: 'ACTIVO' },
  { habilidadId: 'ejemplo-aws', nombre: 'AWS', categoria: 'CLOUD', descripcion: 'Servicios en la nube: Lambda, S3 y DynamoDB', colaboradores: 6, proyectos: 1, estado: 'ACTIVO' },
  { habilidadId: 'ejemplo-flutter', nombre: 'Flutter', categoria: 'FRONTEND', descripcion: 'Apps móviles multiplataforma', colaboradores: 3, proyectos: 1, estado: 'ACTIVO' },
  { habilidadId: 'ejemplo-perl', nombre: 'Perl', categoria: 'BACKEND', descripcion: 'Lenguaje de scripting heredado', colaboradores: 0, proyectos: 0, estado: 'INACTIVO' },
]

const formularioVacio = { nombre: '', categoria: 'FRONTEND', descripcion: '', estado: 'ACTIVO' }
const estaActiva = habilidad => !['INACTIVO', 'INACTIVA'].includes(habilidad.estado?.toUpperCase())
const etiquetaCategoria = valor => categoriasBase.find(categoria => categoria.value === valor)?.label || String(valor || 'General').replaceAll('_', ' ')
const totalRelacionado = valor => Number.isFinite(valor) ? valor : '—'

export default function RrhhHabilidadesVista() {
  const [habilidades, setHabilidades] = useState([])
  const [estadosEjemplo, setEstadosEjemplo] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estado, setEstado] = useState('')
  const [modal, setModal] = useState(null)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [formulario, setFormulario] = useState(formularioVacio)
  const [guardando, setGuardando] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(null)

  const cargarCatalogo = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const respuesta = await habilidadesService.list({ limit: 100 })
      const datos = respuesta.data?.datos
      setHabilidades(Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : [])
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo cargar el catálogo de habilidades.'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarCatalogo() }, [cargarCatalogo])

  // Los datos ficticios son solo una referencia visual en desarrollo.
  const mostrandoEjemplo = import.meta.env.DEV && !cargando && habilidades.length === 0
  const catalogo = mostrandoEjemplo
    ? ejemploCatalogo.map(item => ({ ...item, estado: estadosEjemplo[item.habilidadId] || item.estado }))
    : habilidades
  const categorias = useMemo(() => Array.from(new Set([
    ...categoriasBase.map(item => item.value),
    ...habilidades.map(item => item.categoria).filter(Boolean),
  ])), [habilidades])

  const visibles = useMemo(() => {
    const terminos = [busqueda, busquedaSuperior].map(texto => texto.trim().toLocaleLowerCase('es'))
    return catalogo.filter(habilidad => {
      const contenido = [habilidad.nombre, etiquetaCategoria(habilidad.categoria), habilidad.descripcion]
        .filter(Boolean).join(' ').toLocaleLowerCase('es')
      return terminos.every(texto => contenido.includes(texto)) &&
        (!categoria || habilidad.categoria === categoria) &&
        (!estado || (estaActiva(habilidad) ? 'ACTIVO' : 'INACTIVO') === estado)
    })
  }, [catalogo, busqueda, busquedaSuperior, categoria, estado])

  const abrirFormulario = habilidad => {
    setErrorFormulario('')
    setFormulario(habilidad ? {
      nombre: habilidad.nombre,
      categoria: habilidad.categoria,
      descripcion: habilidad.descripcion || '',
      estado: estaActiva(habilidad) ? 'ACTIVO' : 'INACTIVO',
    } : { ...formularioVacio })
    setModal(habilidad?.habilidadId || 'nueva')
  }

  const guardarHabilidad = async evento => {
    evento.preventDefault()
    if (!formulario.nombre.trim()) return
    setGuardando(true)
    setErrorFormulario('')
    try {
      const datos = { ...formulario, nombre: formulario.nombre.trim(), descripcion: formulario.descripcion.trim() }
      if (modal === 'nueva') {
        await habilidadesService.create({ ...datos, habilidadId: crypto.randomUUID() })
      } else {
        await habilidadesService.update(modal, datos)
      }
      setModal(null)
      await cargarCatalogo()
    } catch (fallo) {
      setErrorFormulario(getApiErrorMessage(fallo, 'No se pudo guardar la habilidad.'))
    } finally {
      setGuardando(false)
    }
  }

  const alternarEstado = async habilidad => {
    if (mostrandoEjemplo) {
      setEstadosEjemplo(previos => ({
        ...previos,
        [habilidad.habilidadId]: estaActiva(habilidad) ? 'INACTIVO' : 'ACTIVO',
      }))
      return
    }
    setCambiandoEstado(habilidad.habilidadId)
    setError('')
    try {
      await habilidadesService.update(habilidad.habilidadId, { estado: estaActiva(habilidad) ? 'INACTIVO' : 'ACTIVO' })
      await cargarCatalogo()
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo cambiar el estado de la habilidad.'))
    } finally {
      setCambiandoEstado(null)
    }
  }

  return (
    <div className="emp-dashboard rrhh-habilidades-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de recursos humanos">
            {menu.map(([texto, ruta]) => (
              <NavLink key={ruta} to={ruta} end className={({ isActive }) => 'emp-sidebar-item' + (isActive ? ' active' : '')}>
                {texto}
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
          <h1 className="emp-header-title">Habilidades</h1>
          <div className="emp-header-right">
            <input
              className="emp-search"
              type="search"
              aria-label="Buscar habilidades desde el encabezado"
              placeholder="Buscar..."
              value={busquedaSuperior}
              onChange={evento => setBusquedaSuperior(evento.target.value)}
            />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content rrhh-habilidades-content" aria-labelledby="rrhh-habilidades-title">
          <div className="rrhh-habilidades-heading">
            <h2 id="rrhh-habilidades-title">Habilidades</h2>
            <button className="rrhh-habilidades-add" type="button" onClick={() => abrirFormulario(null)} disabled={cargando || guardando}>
              <Plus size={16} aria-hidden="true" /> Nueva habilidad
            </button>
          </div>

          <div className="rrhh-habilidades-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Total de habilidades</p>
              <p className="emp-card-value">{catalogo.length}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Activas</p>
              <p className="emp-card-value">{catalogo.filter(estaActiva).length}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Categorías</p>
              <p className="emp-card-value">{new Set(catalogo.map(item => item.categoria)).size}</p>
            </div>
          </div>

          <section className="rrhh-habilidades-panel" aria-labelledby="rrhh-catalogo-title">
            <div className="rrhh-habilidades-panel-header">
              <h3 id="rrhh-catalogo-title">Catálogo de habilidades</h3>
              <div className="rrhh-habilidades-filters">
                <label className="rrhh-habilidades-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Buscar por habilidad, categoría o descripción"
                    placeholder="Buscar habilidad..."
                    value={busqueda}
                    onChange={evento => setBusqueda(evento.target.value)}
                  />
                </label>
                <select aria-label="Filtrar por categoría" value={categoria} onChange={evento => setCategoria(evento.target.value)}>
                  <option value="">Categoría: Todas</option>
                  {categorias.map(valor => <option key={valor} value={valor}>{etiquetaCategoria(valor)}</option>)}
                </select>
                <select aria-label="Filtrar por estado" value={estado} onChange={evento => setEstado(evento.target.value)}>
                  <option value="">Estado: Todos</option>
                  <option value="ACTIVO">Activas</option>
                  <option value="INACTIVO">Inactivas</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="rrhh-habilidades-feedback rrhh-habilidades-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={cargarCatalogo} disabled={cargando}>Reintentar</button>
              </div>
            )}
            {mostrandoEjemplo && (
              <p className="rrhh-habilidades-preview" role="status">
                Vista previa: las habilidades y sus cantidades son datos de ejemplo, no registros guardados.
              </p>
            )}

            {cargando ? (
              <p className="rrhh-habilidades-feedback" role="status">Cargando habilidades...</p>
            ) : (
              <>
                <div className="rrhh-habilidades-table-scroll">
                  <table className="rrhh-habilidades-table">
                    <thead>
                      <tr>
                        <th>Habilidad</th>
                        <th>Categoría</th>
                        <th>Descripción</th>
                        <th>Colaboradores</th>
                        <th>Proyectos</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map(habilidad => (
                        <tr key={habilidad.habilidadId}>
                          <td className="rrhh-habilidades-nombre">{habilidad.nombre}</td>
                          <td>{etiquetaCategoria(habilidad.categoria)}</td>
                          <td className="rrhh-habilidades-descripcion">{habilidad.descripcion || 'Sin descripción'}</td>
                          <td>{totalRelacionado(habilidad.colaboradores)}</td>
                          <td>{totalRelacionado(habilidad.proyectos)}</td>
                          <td>
                            <span className={'rrhh-habilidades-status ' + (estaActiva(habilidad) ? 'activa' : 'inactiva')}>
                              {estaActiva(habilidad) ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td>
                            <div className="rrhh-habilidades-actions">
                              <button
                                type="button"
                                aria-label={'Editar ' + habilidad.nombre}
                                title={mostrandoEjemplo ? 'Vista previa: no se puede editar' : 'Editar ' + habilidad.nombre}
                                onClick={() => abrirFormulario(habilidad)}
                                disabled={mostrandoEjemplo || cambiandoEstado !== null}
                              ><Pencil size={16} aria-hidden="true" /></button>
                              <button
                                type="button"
                                className={'rrhh-habilidades-switch ' + (estaActiva(habilidad) ? 'is-active' : 'is-inactive')}
                                role="switch"
                                aria-checked={estaActiva(habilidad)}
                                aria-label={(estaActiva(habilidad) ? 'Desactivar ' : 'Activar ') + habilidad.nombre}
                                title={(estaActiva(habilidad) ? 'Desactivar ' : 'Activar ') + habilidad.nombre + (mostrandoEjemplo ? ' (vista previa)' : '')}
                                onClick={() => alternarEstado(habilidad)}
                                disabled={cambiandoEstado !== null}
                              ><span className="rrhh-habilidades-switch-thumb" aria-hidden="true" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visibles.length && (
                    <p className="rrhh-habilidades-feedback">No hay habilidades que coincidan con los filtros.</p>
                  )}
                </div>
                <p className="rrhh-habilidades-count">
                  Mostrando {visibles.length} de {catalogo.length} habilidades{mostrandoEjemplo ? ' · datos de ejemplo' : ''}
                </p>
              </>
            )}
          </section>
        </section>
      </main>

      {modal !== null && (
        <div className="rrhh-habilidades-modal-backdrop" onMouseDown={evento => { if (evento.target === evento.currentTarget && !guardando) setModal(null) }}>
          <form className="rrhh-habilidades-modal" role="dialog" aria-modal="true" aria-labelledby="rrhh-habilidades-modal-title" onSubmit={guardarHabilidad}>
            <div className="rrhh-habilidades-modal-heading">
              <h2 id="rrhh-habilidades-modal-title">{modal === 'nueva' ? 'Nueva habilidad' : 'Editar habilidad'}</h2>
              <button type="button" aria-label="Cerrar formulario" onClick={() => setModal(null)} disabled={guardando}><X size={18} /></button>
            </div>
            {errorFormulario && <p className="rrhh-habilidades-error" role="alert">{errorFormulario}</p>}
            <label>Nombre de la habilidad
              <input required maxLength={120} autoFocus value={formulario.nombre} onChange={evento => setFormulario({ ...formulario, nombre: evento.target.value })} />
            </label>
            <label>Categoría
              <select value={formulario.categoria} onChange={evento => setFormulario({ ...formulario, categoria: evento.target.value })}>
                {categorias.map(valor => <option key={valor} value={valor}>{etiquetaCategoria(valor)}</option>)}
              </select>
            </label>
            <label>Descripción
              <textarea rows={3} maxLength={350} value={formulario.descripcion} onChange={evento => setFormulario({ ...formulario, descripcion: evento.target.value })} />
            </label>
            <label>Estado
              <select value={formulario.estado} onChange={evento => setFormulario({ ...formulario, estado: evento.target.value })}>
                <option value="ACTIVO">Activa</option>
                <option value="INACTIVO">Inactiva</option>
              </select>
            </label>
            <div className="rrhh-habilidades-modal-actions">
              <button type="button" className="rrhh-habilidades-cancel" disabled={guardando} onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="rrhh-habilidades-add" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar habilidad'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
