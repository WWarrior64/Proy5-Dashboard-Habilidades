import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { proyectosService } from '../services/proyectos.service.js'
import { habilidadesService } from '../services/habilidades.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import api from '../services/api.js'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import './rrhh-proyectos.css'
import './lider-proyectos.css'

const menu = [
  ['Dashboard', '/dashboards/lider'],
  ['Mis proyectos', '/proyectos'],
  ['Buscar talento', '/colaboradores'],
  ['Postulaciones', '/postulaciones'],
  ['Asignaciones', '/asignaciones'],
]

const estados = [
  { valor: 'BORRADOR', nombre: 'Borrador' },
  { valor: 'ACTIVO', nombre: 'Activo' },
  { valor: 'PAUSADO', nombre: 'Pausado' },
  { valor: 'COMPLETADO', nombre: 'Completado' },
  { valor: 'CANCELADO', nombre: 'Cancelado' },
]

const ejemplosIniciales = [
  { proyectoId: '__ejemplo_sistema', nombre: 'Sistema Web', descripcion: 'Desarrollo del sistema web interno.', horasRequeridas: 120, estado: 'ACTIVO', habilidades: ['React', 'SQL'], esEjemplo: true },
  { proyectoId: '__ejemplo_api', nombre: 'API empresarial', descripcion: 'Servicios para integrar los sistemas de la empresa.', horasRequeridas: 80, estado: 'BORRADOR', habilidades: ['Node.js', 'AWS'], esEjemplo: true },
  { proyectoId: '__ejemplo_movil', nombre: 'Aplicación móvil', descripcion: 'Aplicación para el equipo de operaciones.', horasRequeridas: 100, estado: 'PAUSADO', habilidades: ['Flutter'], esEjemplo: true },
  { proyectoId: '__ejemplo_portal', nombre: 'Portal de clientes', descripcion: 'Portal para los clientes de la organización.', horasRequeridas: 200, estado: 'COMPLETADO', habilidades: ['Vue.js', 'PHP'], esEjemplo: true },
  { proyectoId: '__ejemplo_erp', nombre: 'Integración ERP', descripcion: 'Integración de la plataforma de recursos empresariales.', horasRequeridas: 160, estado: 'CANCELADO', habilidades: ['Java', 'Spring Boot'], esEjemplo: true },
]

const formularioVacio = {
  nombre: '',
  descripcion: '',
  horasRequeridas: '',
  estado: 'BORRADOR',
  habilidadesTexto: '',
}

function obtenerLista(respuesta) {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}

const nombreEstado = estado => estados.find(item => item.valor === estado)?.nombre || estado || 'Sin estado'

export default function LiderProyectosVista() {
  const { user } = useAuth()
  const [proyectos, setProyectos] = useState([])
  const [ejemplos, setEjemplos] = useState(ejemplosIniciales)
  const [habilidadesPorProyecto, setHabilidadesPorProyecto] = useState({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const [formulario, setFormulario] = useState(formularioVacio)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [porCancelar, setPorCancelar] = useState(null)

  const cargarProyectos = useCallback(async () => {
    setCargando(true)
    setError('')
    if (!user?.usuarioId) {
      setProyectos([])
      setError('No se pudo identificar el líder de proyecto.')
      setCargando(false)
      return
    }

    try {
      const respuesta = await proyectosService.list({ liderId: user.usuarioId })
      const lista = obtenerLista(respuesta).filter(item => item.liderId === user.usuarioId)
      setProyectos(lista)

      if (lista.length) {
        const [catalogo, ...resultadosRelaciones] = await Promise.allSettled([
          habilidadesService.list({ limit: 100 }),
          ...lista.map(item => api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/habilidades`)),
        ])
        const nombres = catalogo.status === 'fulfilled'
          ? new Map(obtenerLista(catalogo.value).map(item => [item.habilidadId, item.nombre]))
          : new Map()
        const resultado = {}
        lista.forEach((item, indice) => {
          const relacionado = resultadosRelaciones[indice]
          if (relacionado.status === 'fulfilled') {
            resultado[item.proyectoId] = obtenerLista(relacionado.value).map(relacion =>
              nombres.get(relacion.habilidadId) || relacion.nombre || relacion.habilidadId,
            )
          }
        })
        setHabilidadesPorProyecto(resultado)
      } else {
        setHabilidadesPorProyecto({})
      }
    } catch (fallo) {
      setProyectos([])
      setError(getApiErrorMessage(fallo, 'No se pudieron cargar los proyectos.'))
    } finally {
      setCargando(false)
    }
  }, [user?.usuarioId])

  useEffect(() => { cargarProyectos() }, [cargarProyectos])

  // Los registros ficticios existen solo en el frontend de desarrollo.
  const mostrandoEjemplo = import.meta.env.DEV && !cargando && proyectos.length === 0
  const catalogo = useMemo(() => (mostrandoEjemplo ? ejemplos : proyectos).map(item => ({
    ...item,
    habilidadesMostrar: mostrandoEjemplo ? item.habilidades : (habilidadesPorProyecto[item.proyectoId] ||
      (Array.isArray(item.habilidades) ? item.habilidades : [])).map(habilidad =>
      typeof habilidad === 'string' ? habilidad : habilidad.nombre || habilidad.habilidadId || '',
    ),
  })), [mostrandoEjemplo, ejemplos, proyectos, habilidadesPorProyecto])

  const visibles = useMemo(() => {
    const terminos = [busqueda, busquedaSuperior].map(texto => texto.trim().toLocaleLowerCase('es'))
    return catalogo.filter(item => {
      const contenido = [item.nombre, item.descripcion, ...(item.habilidadesMostrar || [])]
        .filter(Boolean).join(' ').toLocaleLowerCase('es')
      return terminos.every(texto => contenido.includes(texto)) &&
        (!estadoFiltro || item.estado === estadoFiltro)
    })
  }, [catalogo, busqueda, busquedaSuperior, estadoFiltro])

  const totalActivos = catalogo.filter(item => item.estado === 'ACTIVO').length
  const horasRequeridas = catalogo.reduce((suma, item) => suma + (Number(item.horasRequeridas) || 0), 0)
  const porIniciar = catalogo.filter(item => item.estado === 'BORRADOR').length

  const abrirFormulario = item => {
    setErrorFormulario('')
    setFormulario(item ? {
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      horasRequeridas: String(item.horasRequeridas || ''),
      estado: item.estado,
      habilidadesTexto: (item.habilidadesMostrar || []).join(', '),
    } : { ...formularioVacio })
    setModal(item || { proyectoId: null })
  }

  const guardarProyecto = async evento => {
    evento.preventDefault()
    const nombre = formulario.nombre.trim()
    const descripcion = formulario.descripcion.trim()
    const horas = Number(formulario.horasRequeridas)
    if (!nombre || !descripcion || !Number.isFinite(horas) || horas <= 0) {
      setErrorFormulario('Completa el nombre, la descripción y una cantidad de horas válida.')
      return
    }

    setGuardando(true)
    setErrorFormulario('')
    try {
      const cambios = { nombre, descripcion, horasRequeridas: horas, estado: formulario.estado }
      if (mostrandoEjemplo) {
        const habilidades = formulario.habilidadesTexto.split(',').map(texto => texto.trim()).filter(Boolean)
        if (modal.proyectoId) {
          setEjemplos(actuales => actuales.map(item =>
            item.proyectoId === modal.proyectoId ? { ...item, ...cambios, habilidades } : item,
          ))
        } else {
          setEjemplos(actuales => [...actuales, {
            ...cambios, proyectoId: '__ejemplo_' + crypto.randomUUID(), habilidades, esEjemplo: true,
          }])
        }
      } else if (modal.proyectoId) {
        await proyectosService.update(modal.proyectoId, cambios)
        await cargarProyectos()
      } else {
        await proyectosService.create({ ...cambios, liderId: user.usuarioId, creadoPor: user.usuarioId })
        await cargarProyectos()
      }
      setModal(null)
    } catch (fallo) {
      setErrorFormulario(getApiErrorMessage(fallo, 'No se pudo guardar el proyecto.'))
    } finally {
      setGuardando(false)
    }
  }

  const cancelarProyecto = async () => {
    if (!porCancelar) return
    setGuardando(true)
    setError('')
    try {
      if (porCancelar.esEjemplo) {
        setEjemplos(actuales => actuales.map(item =>
          item.proyectoId === porCancelar.proyectoId ? { ...item, estado: 'CANCELADO' } : item,
        ))
      } else {
        // El backend conserva el registro; la operación lo cambia a CANCELADO.
        await proyectosService.remove(porCancelar.proyectoId)
        await cargarProyectos()
      }
      setPorCancelar(null)
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo cancelar el proyecto.'))
      setPorCancelar(null)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="emp-dashboard rrhh-proyectos-page lider-proyectos-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de líder de proyecto">
            {menu.map(([titulo, ruta]) => (
              <NavLink key={ruta} to={ruta} end className={({ isActive }) =>
                'emp-sidebar-item' + (isActive ? ' active' : '')
              }>{titulo}</NavLink>
            ))}
          </nav>
        </div>
        <div className="emp-sidebar-bottom">
          <span className="emp-sidebar-user">Líder de proyecto</span>
          <EmpleadoLogoutButton />
        </div>
      </aside>

      <main className="emp-main">
        <header className="emp-header">
          <h1 className="emp-header-title">Mis proyectos</h1>
          <div className="emp-header-right">
            <input className="emp-search" type="search" placeholder="Buscar..."
              aria-label="Buscar proyectos desde el encabezado"
              value={busquedaSuperior} onChange={evento => setBusquedaSuperior(evento.target.value)} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content rrhh-proyectos-content lider-proyectos-content" aria-labelledby="lider-proyectos-titulo">
          <div className="rrhh-proyectos-heading">
            <h2 id="lider-proyectos-titulo">Proyectos</h2>
            <button className="rrhh-proyectos-add" type="button" onClick={() => abrirFormulario(null)} disabled={cargando || guardando}>
              <Plus size={16} aria-hidden="true" /> Nuevo proyecto
            </button>
          </div>

          <div className="rrhh-proyectos-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Proyectos activos</p>
              <p className="emp-card-value">{cargando ? '—' : totalActivos}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Horas requeridas</p>
              <p className="emp-card-value">{cargando ? '—' : horasRequeridas}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Por iniciar</p>
              <p className="emp-card-value">{cargando ? '—' : porIniciar}</p>
            </div>
          </div>

          <section className="rrhh-proyectos-panel" aria-labelledby="lider-proyectos-listado">
            <div className="rrhh-proyectos-panel-header">
              <h3 id="lider-proyectos-listado">Proyectos internos</h3>
              <div className="rrhh-proyectos-filters">
                <label className="rrhh-proyectos-search">
                  <Search size={15} aria-hidden="true" />
                  <input type="search" placeholder="Buscar proyecto..." aria-label="Buscar proyectos por nombre o habilidad"
                    value={busqueda} onChange={evento => setBusqueda(evento.target.value)} />
                </label>
                <select aria-label="Filtrar por estado" value={estadoFiltro} onChange={evento => setEstadoFiltro(evento.target.value)}>
                  <option value="">Estado: Todos</option>
                  {estados.map(item => <option key={item.valor} value={item.valor}>{item.nombre}</option>)}
                </select>
              </div>
            </div>

            {error && (
              <div className="rrhh-proyectos-feedback rrhh-proyectos-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={cargarProyectos} disabled={cargando}>Reintentar</button>
              </div>
            )}
            {mostrandoEjemplo && (
              <p className="rrhh-proyectos-preview" role="status">
                Vista previa: estos proyectos son datos de ejemplo del frontend. Los cambios no se guardan en el backend.
              </p>
            )}

            {cargando ? (
              <p className="rrhh-proyectos-feedback" role="status">Cargando proyectos...</p>
            ) : (
              <>
                <div className="rrhh-proyectos-table-scroll">
                  <table className="rrhh-proyectos-table">
                    <thead>
                      <tr>
                        <th>Proyecto</th>
                        <th>Habilidades requeridas</th>
                        <th>Horas</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map(item => (
                        <tr key={item.proyectoId}>
                          <td className="rrhh-proyectos-nombre">{item.nombre}</td>
                          <td>{item.habilidadesMostrar?.length ? item.habilidadesMostrar.join(', ') : '—'}</td>
                          <td>{item.horasRequeridas ?? '—'}</td>
                          <td>
                            <span className={'rrhh-proyectos-status ' + (item.estado || 'BORRADOR').toLowerCase()}>
                              {nombreEstado(item.estado)}
                            </span>
                          </td>
                          <td>
                            <div className="rrhh-proyectos-actions lider-proyectos-actions">
                              <button type="button" aria-label={'Editar ' + item.nombre} title={'Editar ' + item.nombre}
                                onClick={() => abrirFormulario(item)} disabled={guardando}>
                                <Pencil size={16} aria-hidden="true" />
                              </button>
                              <button type="button" className="lider-proyectos-cancelar"
                                aria-label={'Cancelar ' + item.nombre}
                                title={item.estado === 'CANCELADO' ? 'Proyecto ya cancelado' : 'Cancelar ' + item.nombre}
                                onClick={() => setPorCancelar(item)}
                                disabled={guardando || item.estado === 'CANCELADO'}>
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visibles.length && <p className="rrhh-proyectos-feedback">No hay proyectos que coincidan con los filtros.</p>}
                </div>
                <p className="rrhh-proyectos-count">
                  Mostrando {visibles.length} de {catalogo.length} proyectos{mostrandoEjemplo ? ' · datos de ejemplo' : ''}
                </p>
              </>
            )}
          </section>
        </section>
      </main>

      {modal && (
        <div className="lider-proyectos-overlay" onMouseDown={evento => {
          if (evento.target === evento.currentTarget && !guardando) setModal(null)
        }}>
          <form role="dialog" aria-modal="true" aria-labelledby="lider-proyectos-modal-titulo" className="lider-proyectos-dialog" onSubmit={guardarProyecto}>
            <div className="lider-proyectos-dialog-heading">
              <h2 id="lider-proyectos-modal-titulo">{modal.proyectoId ? 'Editar proyecto' : 'Nuevo proyecto'}</h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Cerrar formulario" disabled={guardando}><X size={18} /></button>
            </div>
            {errorFormulario && <p className="lider-proyectos-form-error" role="alert">{errorFormulario}</p>}
            <label>Nombre del proyecto
              <input autoFocus required maxLength={150} value={formulario.nombre}
                onChange={evento => setFormulario({ ...formulario, nombre: evento.target.value })} />
            </label>
            <label>Descripción
              <textarea required rows={3} maxLength={500} value={formulario.descripcion}
                onChange={evento => setFormulario({ ...formulario, descripcion: evento.target.value })} />
            </label>
            <label>Horas requeridas
              <input type="number" min="1" step="1" required value={formulario.horasRequeridas}
                onChange={evento => setFormulario({ ...formulario, horasRequeridas: evento.target.value })} />
            </label>
            <label>Estado
              <select value={formulario.estado} onChange={evento => setFormulario({ ...formulario, estado: evento.target.value })}>
                {estados.map(item => <option key={item.valor} value={item.valor}>{item.nombre}</option>)}
              </select>
            </label>
            {mostrandoEjemplo && (
              <label>Habilidades requeridas (vista previa)
                <input placeholder="React, SQL..." value={formulario.habilidadesTexto}
                  onChange={evento => setFormulario({ ...formulario, habilidadesTexto: evento.target.value })} />
              </label>
            )}
            <div className="lider-proyectos-dialog-actions">
              <button type="button" className="lider-proyectos-cancelar-modal" disabled={guardando} onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="rrhh-proyectos-add" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar proyecto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {porCancelar && (
        <div className="lider-proyectos-overlay" onMouseDown={evento => {
          if (evento.target === evento.currentTarget && !guardando) setPorCancelar(null)
        }}>
          <section className="lider-proyectos-dialog" role="alertdialog" aria-modal="true" aria-labelledby="lider-proyectos-cancelar-titulo">
            <div className="lider-proyectos-dialog-heading">
              <h2 id="lider-proyectos-cancelar-titulo">¿Cancelar proyecto?</h2>
              <button type="button" aria-label="Cerrar confirmación" onClick={() => setPorCancelar(null)} disabled={guardando}><X size={18} /></button>
            </div>
            <p className="lider-proyectos-confirm-text">
              El proyecto <strong>{porCancelar.nombre}</strong> cambiará al estado «Cancelado».
              {porCancelar.esEjemplo ? ' Este cambio solo se reflejará en los datos de ejemplo.' : ' El historial del proyecto se conservará.'}
            </p>
            <div className="lider-proyectos-dialog-actions">
              <button type="button" className="lider-proyectos-cancelar-modal" onClick={() => setPorCancelar(null)} disabled={guardando}>Volver</button>
              <button type="button" className="lider-proyectos-confirmar" onClick={cancelarProyecto} disabled={guardando}>
                <Trash2 size={16} aria-hidden="true" /> {guardando ? 'Cancelando...' : 'Cancelar proyecto'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
