import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Pencil, Plus, Search, Unlink2, UserRound, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { asignacionesService } from '../services/asignaciones.service.js'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { proyectosService } from '../services/proyectos.service.js'
import { usuariosService } from '../services/usuarios.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import './rrhh-asignaciones.css'

const menu = [
  ['Dashboard', '/dashboards/rrhh'],
  ['Colaboradores', '/colaboradores'],
  ['Habilidades', '/habilidades'],
  ['Proyectos', '/proyectos'],
  ['Asignaciones', '/asignaciones'],
]

const asignacionesDeEjemplo = [
  { asignacionId: '__ejemplo_1', colaboradorId: '__ejemplo_carlos', proyectoId: '__ejemplo_web', colaborador: 'Carlos Méndez', proyecto: 'Sistema Web', porcentajeDedicacion: 50, horasAsignadas: 20, estado: 'ACTIVA', esEjemplo: true },
  { asignacionId: '__ejemplo_2', colaboradorId: '__ejemplo_ana', proyectoId: '__ejemplo_api', colaborador: 'Ana López', proyecto: 'API Empresarial', porcentajeDedicacion: 75, horasAsignadas: 30, estado: 'ACTIVA', esEjemplo: true },
  { asignacionId: '__ejemplo_3', colaboradorId: '__ejemplo_luis', proyectoId: '__ejemplo_web', colaborador: 'Luis Pérez', proyecto: 'Sistema Web', porcentajeDedicacion: 25, horasAsignadas: 10, estado: 'ACTIVA', esEjemplo: true },
]

const extraerLista = respuesta => {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}

const formularioInicial = { colaboradorId: '', proyectoId: '', porcentajeDedicacion: '50', horasAsignadas: '20' }

export default function RrhhAsignacionesVista() {
  const { user } = useAuth()
  const [asignaciones, setAsignaciones] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [ejemplos, setEjemplos] = useState(asignacionesDeEjemplo)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [modal, setModal] = useState(null)
  const [formulario, setFormulario] = useState(formularioInicial)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [porDesvincular, setPorDesvincular] = useState(null)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError('')
    const [resultadoAsignaciones, resultadoColaboradores, resultadoProyectos, resultadoUsuarios] = await Promise.allSettled([
      asignacionesService.list(),
      colaboradoresService.listAll(),
      proyectosService.list(),
      usuariosService.listAll(),
    ])
    if (resultadoAsignaciones.status === 'fulfilled') {
      setAsignaciones(extraerLista(resultadoAsignaciones.value))
    } else {
      setError(getApiErrorMessage(resultadoAsignaciones.reason, 'No fue posible cargar las asignaciones.'))
    }
    setColaboradores(resultadoColaboradores.status === 'fulfilled' ? extraerLista(resultadoColaboradores.value) : [])
    setProyectos(resultadoProyectos.status === 'fulfilled' ? extraerLista(resultadoProyectos.value) : [])
    setUsuarios(resultadoUsuarios.status === 'fulfilled' ? extraerLista(resultadoUsuarios.value) : [])
    setCargando(false)
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const mostrandoEjemplo = import.meta.env.DEV && !cargando && asignaciones.length === 0
  const usuariosPorId = useMemo(() => new Map(usuarios.map(item => [item.usuarioId, item.nombre])), [usuarios])
  const opcionesColaboradores = useMemo(() => colaboradores
    .filter(item => item.estado !== 'INACTIVO')
    .map(item => ({
      id: item.colaboradorId,
      nombre: usuariosPorId.get(item.usuarioId) || item.nombre || item.colaboradorId,
    })), [colaboradores, usuariosPorId])
  const opcionesProyectos = useMemo(() => proyectos
    .filter(item => item.estado === 'ACTIVO')
    .map(item => ({ id: item.proyectoId, nombre: item.nombre || item.proyectoId })), [proyectos])

  const catalogo = useMemo(() => {
    if (mostrandoEjemplo) return ejemplos
    const nombresColaboradores = new Map(colaboradores.map(item => [
      item.colaboradorId,
      usuariosPorId.get(item.usuarioId) || item.nombre || item.colaboradorId,
    ]))
    const nombresProyectos = new Map(proyectos.map(item => [item.proyectoId, item.nombre]))
    return asignaciones.map(item => ({
      ...item,
      colaborador: nombresColaboradores.get(item.colaboradorId) || item.colaborador || 'Colaborador sin nombre',
      proyecto: nombresProyectos.get(item.proyectoId) || item.proyecto || 'Proyecto sin nombre',
    }))
  }, [asignaciones, colaboradores, proyectos, usuariosPorId, mostrandoEjemplo, ejemplos])

  const proyectosFiltro = useMemo(() => Array.from(new Set(catalogo.map(item => item.proyecto))).sort(), [catalogo])
  const visibles = useMemo(() => {
    const terminos = [busqueda, busquedaSuperior].map(valor => valor.trim().toLocaleLowerCase('es'))
    return catalogo.filter(item => {
      const contenido = [item.colaborador, item.proyecto].join(' ').toLocaleLowerCase('es')
      return terminos.every(termino => contenido.includes(termino)) &&
        (!filtroProyecto || item.proyecto === filtroProyecto)
    })
  }, [catalogo, busqueda, busquedaSuperior, filtroProyecto])

  const activas = catalogo.filter(item => item.estado === 'ACTIVA')
  const promedio = activas.length
    ? Math.round(activas.reduce((suma, item) => suma + (Number(item.porcentajeDedicacion) || 0), 0) / activas.length)
    : 0
  const horas = activas.reduce((suma, item) => suma + (Number(item.horasAsignadas) || 0), 0)
  const usarEjemplosAlCrear = mostrandoEjemplo && (!opcionesColaboradores.length || !opcionesProyectos.length)
  const personasFormulario = usarEjemplosAlCrear
    ? Array.from(new Map(asignacionesDeEjemplo.map(item => [item.colaboradorId, { id: item.colaboradorId, nombre: item.colaborador }])).values())
    : opcionesColaboradores
  const proyectosFormulario = usarEjemplosAlCrear
    ? Array.from(new Map(asignacionesDeEjemplo.map(item => [item.proyectoId, { id: item.proyectoId, nombre: item.proyecto }])).values())
    : opcionesProyectos

  const abrirNuevo = () => {
    setErrorFormulario('')
    setFormulario({
      ...formularioInicial,
      colaboradorId: personasFormulario[0]?.id || '',
      proyectoId: proyectosFormulario[0]?.id || '',
    })
    setModal({ tipo: 'nuevo' })
  }

  const abrirEdicion = item => {
    setErrorFormulario('')
    setFormulario({
      colaboradorId: item.colaboradorId,
      proyectoId: item.proyectoId,
      porcentajeDedicacion: String(item.porcentajeDedicacion),
      horasAsignadas: String(item.horasAsignadas),
    })
    setModal({ tipo: 'editar', item })
  }

  const guardar = async evento => {
    evento.preventDefault()
    if (!modal) return
    const porcentajeDedicacion = Number(formulario.porcentajeDedicacion)
    const horasAsignadas = Number(formulario.horasAsignadas)
    if (!formulario.colaboradorId || !formulario.proyectoId || porcentajeDedicacion <= 0 ||
        porcentajeDedicacion > 100 || !Number.isFinite(porcentajeDedicacion) || horasAsignadas <= 0 ||
        !Number.isFinite(horasAsignadas)) {
      setErrorFormulario('Selecciona un colaborador y un proyecto, con dedicación de 1 a 100 % y horas mayores que cero.')
      return
    }

    setOcupado(true)
    setErrorFormulario('')
    try {
      if (modal.tipo === 'editar' && modal.item.esEjemplo) {
        setEjemplos(actuales => actuales.map(item => item.asignacionId === modal.item.asignacionId
          ? { ...item, porcentajeDedicacion, horasAsignadas }
          : item))
      } else if (modal.tipo === 'nuevo' && usarEjemplosAlCrear) {
        const persona = personasFormulario.find(item => item.id === formulario.colaboradorId)
        const proyecto = proyectosFormulario.find(item => item.id === formulario.proyectoId)
        setEjemplos(actuales => [...actuales, {
          asignacionId: '__ejemplo_' + Date.now(),
          colaboradorId: formulario.colaboradorId,
          proyectoId: formulario.proyectoId,
          colaborador: persona.nombre,
          proyecto: proyecto.nombre,
          porcentajeDedicacion,
          horasAsignadas,
          estado: 'ACTIVA',
          esEjemplo: true,
        }])
      } else if (modal.tipo === 'nuevo') {
        await asignacionesService.create({
          colaboradorId: formulario.colaboradorId,
          proyectoId: formulario.proyectoId,
          porcentajeDedicacion,
          horasAsignadas,
          creadoPor: user?.usuarioId,
        })
        await cargarDatos()
      } else {
        await asignacionesService.update(modal.item.asignacionId, { porcentajeDedicacion, horasAsignadas })
        await cargarDatos()
      }
      setModal(null)
    } catch (fallo) {
      setErrorFormulario(getApiErrorMessage(fallo, 'No fue posible guardar la asignación.'))
    } finally {
      setOcupado(false)
    }
  }

  const desvincular = async () => {
    if (!porDesvincular) return
    setOcupado(true)
    setError('')
    try {
      if (porDesvincular.esEjemplo) {
        setEjemplos(actuales => actuales.filter(item => item.asignacionId !== porDesvincular.asignacionId))
      } else {
        // DELETE realiza una desvinculación lógica; no borra el historial.
        await asignacionesService.remove(porDesvincular.asignacionId)
        await cargarDatos()
      }
      setPorDesvincular(null)
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No fue posible desvincular esta asignación.'))
      setPorDesvincular(null)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="emp-dashboard rrhh-asignaciones-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de recursos humanos">
            {menu.map(([nombre, ruta]) => (
              <NavLink key={ruta} to={ruta} end className={({ isActive }) => 'emp-sidebar-item' + (isActive ? ' active' : '')}>
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
          <h1 className="emp-header-title">Asignaciones</h1>
          <div className="emp-header-right">
            <input
              className="emp-search"
              type="search"
              placeholder="Buscar..."
              aria-label="Buscar asignaciones desde el encabezado"
              value={busquedaSuperior}
              onChange={evento => setBusquedaSuperior(evento.target.value)}
            />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content rrhh-asignaciones-content" aria-labelledby="rrhh-asignaciones-title">
          <div className="rrhh-asignaciones-heading">
            <h2 id="rrhh-asignaciones-title" className="rrhh-asignaciones-title">Asignaciones</h2>
            <button type="button" className="rrhh-asignaciones-add" onClick={abrirNuevo} disabled={cargando || ocupado}>
              <Plus size={16} aria-hidden="true" /> Nueva asignación
            </button>
          </div>
          <div className="rrhh-asignaciones-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Asignaciones activas</p>
              <p className="emp-card-value">{activas.length}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Dedicación promedio</p>
              <p className="emp-card-value">{promedio}%</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Horas asignadas</p>
              <p className="emp-card-value">{horas}</p>
            </div>
          </div>

          <section className="rrhh-asignaciones-panel" aria-labelledby="rrhh-asignaciones-listado">
            <div className="rrhh-asignaciones-panel-header">
              <h3 id="rrhh-asignaciones-listado">Asignaciones activas</h3>
              <div className="rrhh-asignaciones-panel-controls">
                <label className="rrhh-asignaciones-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Buscar colaborador o proyecto"
                    placeholder="Buscar..."
                    value={busqueda}
                    onChange={evento => setBusqueda(evento.target.value)}
                  />
                </label>
                <select aria-label="Filtrar por proyecto" value={filtroProyecto} onChange={evento => setFiltroProyecto(evento.target.value)}>
                  <option value="">Proyecto: Todos</option>
                  {proyectosFiltro.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                </select>
              </div>
            </div>

            {error && (
              <div className="rrhh-asignaciones-feedback rrhh-asignaciones-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={cargarDatos} disabled={cargando}>Reintentar</button>
              </div>
            )}
            {mostrandoEjemplo && (
              <p className="rrhh-asignaciones-preview" role="status">
                Vista previa: estas asignaciones son datos ficticios. Los cambios de ejemplo no se guardan en el backend.
              </p>
            )}
            {cargando ? (
              <p className="rrhh-asignaciones-feedback" role="status">Cargando asignaciones...</p>
            ) : (
              <>
                <div className="rrhh-asignaciones-table-scroll">
                  <table className="rrhh-asignaciones-table">
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th>Proyecto</th>
                        <th>Dedicación</th>
                        <th>Horas</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map(item => (
                        <tr key={item.asignacionId}>
                          <td className="rrhh-asignaciones-nombre">{item.colaborador}</td>
                          <td>{item.proyecto}</td>
                          <td>{item.porcentajeDedicacion}%</td>
                          <td>{item.horasAsignadas}</td>
                          <td><span className="rrhh-asignaciones-status">Activa</span></td>
                          <td>
                            <div className="rrhh-asignaciones-actions">
                              <button
                                type="button"
                                aria-label={'Editar asignación de ' + item.colaborador}
                                title={'Editar asignación de ' + item.colaborador}
                                onClick={() => abrirEdicion(item)}
                                disabled={ocupado}
                              ><Pencil size={16} aria-hidden="true" /></button>
                              <button
                                type="button"
                                className="rrhh-asignaciones-unlink"
                                aria-label={'Desvincular a ' + item.colaborador + ' de ' + item.proyecto}
                                title={'Desvincular a ' + item.colaborador + ' de ' + item.proyecto}
                                onClick={() => setPorDesvincular(item)}
                                disabled={ocupado}
                              ><Unlink2 size={17} aria-hidden="true" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visibles.length && <p className="rrhh-asignaciones-feedback">No hay asignaciones que coincidan con los filtros.</p>}
                </div>
                <p className="rrhh-asignaciones-count">Mostrando {visibles.length} de {catalogo.length} asignaciones{mostrandoEjemplo ? ' · datos de ejemplo' : ''}</p>
              </>
            )}
          </section>
        </section>
      </main>

      {modal && (
        <div className="rrhh-asignaciones-backdrop" onMouseDown={evento => { if (evento.target === evento.currentTarget && !ocupado) setModal(null) }}>
          <form className="rrhh-asignaciones-dialog" role="dialog" aria-modal="true" aria-labelledby="rrhh-asignaciones-modal-title" onSubmit={guardar}>
            <div className="rrhh-asignaciones-dialog-heading">
              <h2 id="rrhh-asignaciones-modal-title">{modal.tipo === 'nuevo' ? 'Nueva asignación' : 'Editar asignación'}</h2>
              <button type="button" aria-label="Cerrar formulario" onClick={() => setModal(null)} disabled={ocupado}><X size={18} /></button>
            </div>
            {errorFormulario && <p className="rrhh-asignaciones-modal-error" role="alert">{errorFormulario}</p>}
            {usarEjemplosAlCrear && modal.tipo === 'nuevo' && (
              <p className="rrhh-asignaciones-preview">Vista previa: esta asignación será solamente de ejemplo.</p>
            )}
            <label>Colaborador
              <select value={formulario.colaboradorId} disabled={modal.tipo === 'editar' || ocupado} required onChange={evento => setFormulario({ ...formulario, colaboradorId: evento.target.value })}>
                <option value="">Seleccionar colaborador</option>
                {(modal.tipo === 'editar' && modal.item.esEjemplo ? [{ id: modal.item.colaboradorId, nombre: modal.item.colaborador }] : personasFormulario).map(item => (
                  <option key={item.id} value={item.id}>{item.nombre}</option>
                ))}
                {modal.tipo === 'editar' && !modal.item.esEjemplo && !opcionesColaboradores.some(item => item.id === formulario.colaboradorId) && (
                  <option value={formulario.colaboradorId}>{modal.item.colaborador}</option>
                )}
              </select>
            </label>
            <label>Proyecto
              <select value={formulario.proyectoId} disabled={modal.tipo === 'editar' || ocupado} required onChange={evento => setFormulario({ ...formulario, proyectoId: evento.target.value })}>
                <option value="">Seleccionar proyecto</option>
                {(modal.tipo === 'editar' && modal.item.esEjemplo ? [{ id: modal.item.proyectoId, nombre: modal.item.proyecto }] : proyectosFormulario).map(item => (
                  <option key={item.id} value={item.id}>{item.nombre}</option>
                ))}
                {modal.tipo === 'editar' && !modal.item.esEjemplo && !opcionesProyectos.some(item => item.id === formulario.proyectoId) && (
                  <option value={formulario.proyectoId}>{modal.item.proyecto}</option>
                )}
              </select>
            </label>
            <label>Dedicación (%)
              <input required type="number" min="1" max="100" step="1" value={formulario.porcentajeDedicacion} onChange={evento => setFormulario({ ...formulario, porcentajeDedicacion: evento.target.value })} />
            </label>
            <label>Horas asignadas
              <input required type="number" min="1" step="1" value={formulario.horasAsignadas} onChange={evento => setFormulario({ ...formulario, horasAsignadas: evento.target.value })} />
            </label>
            <div className="rrhh-asignaciones-dialog-actions">
              <button type="button" className="rrhh-asignaciones-cancel" onClick={() => setModal(null)} disabled={ocupado}>Cancelar</button>
              <button type="submit" className="rrhh-asignaciones-add" disabled={ocupado || !formulario.colaboradorId || !formulario.proyectoId}>
                {ocupado ? 'Guardando...' : 'Guardar asignación'}
              </button>
            </div>
          </form>
        </div>
      )}

      {porDesvincular && (
        <div className="rrhh-asignaciones-backdrop" onMouseDown={evento => { if (evento.target === evento.currentTarget && !ocupado) setPorDesvincular(null) }}>
          <section className="rrhh-asignaciones-dialog" role="alertdialog" aria-modal="true" aria-labelledby="rrhh-asignaciones-confirmar-title">
            <div className="rrhh-asignaciones-dialog-heading">
              <h2 id="rrhh-asignaciones-confirmar-title">¿Desvincular asignación?</h2>
              <button type="button" aria-label="Cerrar confirmación" onClick={() => setPorDesvincular(null)} disabled={ocupado}><X size={18} /></button>
            </div>
            <p className="rrhh-asignaciones-confirm-text">
              Se desvinculará a <strong>{porDesvincular.colaborador}</strong> de <strong>{porDesvincular.proyecto}</strong>.
              {porDesvincular.esEjemplo ? ' Este cambio solo afectará a la vista previa.' : ' La asignación quedará registrada como desvinculada.'}
            </p>
            <div className="rrhh-asignaciones-dialog-actions">
              <button type="button" className="rrhh-asignaciones-cancel" onClick={() => setPorDesvincular(null)} disabled={ocupado}>Cancelar</button>
              <button type="button" className="rrhh-asignaciones-confirm-unlink" onClick={desvincular} disabled={ocupado}>
                <Unlink2 size={16} aria-hidden="true" /> {ocupado ? 'Desvinculando...' : 'Desvincular'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
