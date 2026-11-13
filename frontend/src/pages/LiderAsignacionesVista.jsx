import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CheckCircle2, MoreHorizontal, Pencil, Plus, Search, Unlink2, UserRound, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { proyectosService } from '../services/proyectos.service.js'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { asignacionesService } from '../services/asignaciones.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import { nombreColaborador } from '../utils/formatters.js'
import { rangoFechasProyecto } from '../utils/proyectoFechas.js'
import { esCandidatoAsignable } from '../utils/asignacionElegibilidad.js'
import MisParticipaciones from '../components/asignaciones/MisParticipaciones.jsx'
import api from '../services/api.js'
import './lider-asignaciones.css'

const menu = [
  ['Dashboard', '/dashboards/lider'],
  ['Mis proyectos', '/proyectos'],
  ['Buscar talento', '/colaboradores'],
  ['Postulaciones', '/postulaciones'],
  ['Asignaciones', '/asignaciones'],
]

const demoProyectos = [
  { proyectoId: '__demo_portal', nombre: 'Portal de clientes', estado: 'ACTIVO', horasRequeridas: 80, fechaInicio: '2026-11-01', fechaFin: '2026-12-15', esEjemplo: true },
  { proyectoId: '__demo_movil', nombre: 'App móvil', estado: 'ACTIVO', horasRequeridas: 100, fechaInicio: '2026-11-15', fechaFin: '2027-01-31', esEjemplo: true },
  { proyectoId: '__demo_sistema', nombre: 'Sistema Web', estado: 'COMPLETADO', horasRequeridas: 120, fechaInicio: '2026-10-01', fechaFin: '2026-11-10', esEjemplo: true },
]

const demoAsignacionesIniciales = [
  { asignacionId: '__demo_carlos', proyectoId: '__demo_portal', colaboradorId: '__demo_col_carlos', colaborador: 'Carlos Méndez', rol: 'Desarrollador Backend', porcentajeDedicacion: 40, horasAsignadas: 40, horasCompletadas: 12, fechaInicio: '2026-11-01', estado: 'ACTIVA', esEjemplo: true },
  { asignacionId: '__demo_ana', proyectoId: '__demo_portal', colaboradorId: '__demo_col_ana', colaborador: 'Ana López', rol: 'Desarrolladora Frontend', porcentajeDedicacion: 50, horasAsignadas: 40, horasCompletadas: 5, fechaInicio: '2026-11-01', estado: 'ACTIVA', esEjemplo: true },
  { asignacionId: '__demo_valeria', proyectoId: '__demo_sistema', colaboradorId: '__demo_col_valeria', colaborador: 'Valeria Cruz', rol: 'Ingeniera Cloud', porcentajeDedicacion: 25, horasAsignadas: 30, horasCompletadas: 30, fechaInicio: '2026-10-01', estado: 'FINALIZADA', esEjemplo: true },
  { asignacionId: '__demo_diego', proyectoId: '__demo_sistema', colaboradorId: '__demo_col_diego', colaborador: 'Diego Rivas', rol: 'Desarrollador Móvil', porcentajeDedicacion: 20, horasAsignadas: 20, horasCompletadas: 10, fechaInicio: '2026-10-05', estado: 'DESVINCULADA', esEjemplo: true },
]

const demoPersonas = [
  { colaboradorId: '__demo_col_carlos', nombre: 'Carlos Méndez', rol: 'Desarrollador Backend', esEjemplo: true },
  { colaboradorId: '__demo_col_ana', nombre: 'Ana López', rol: 'Desarrolladora Frontend', esEjemplo: true },
  { colaboradorId: '__demo_col_valeria', nombre: 'Valeria Cruz', rol: 'Ingeniera Cloud', esEjemplo: true },
  { colaboradorId: '__demo_col_diego', nombre: 'Diego Rivas', rol: 'Desarrollador Móvil', esEjemplo: true },
]

const formularioInicial = { proyectoId: '', colaboradorId: '', porcentajeDedicacion: '25', horasAsignadas: '20', horasCompletadas: '0' }

const extraer = respuesta => {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}
const fecha = valor => {
  if (!valor || typeof valor !== 'string') return '—'
  const [anio, mes, dia] = valor.slice(0, 10).split('-')
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '—'
}
const iniciales = nombre => String(nombre || 'C').trim().split(/\s+/).slice(0, 2)
  .map(p => p.charAt(0)).join('').toUpperCase()
const numero = valor => Number.isFinite(Number(valor)) && valor != null ? Number(valor) : 0
const progreso = (valor, total) => total > 0 ? Math.min(100, Math.max(0, numero(valor) / total * 100)) : 0
const nombreEstado = valor => ({ ACTIVA: 'Activa', FINALIZADA: 'Finalizada', DESVINCULADA: 'Desvinculada' })[valor] || valor

export default function LiderAsignacionesVista() {
  const { user } = useAuth()
  const [proyectos, setProyectos] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [historialCompleto, setHistorialCompleto] = useState(false)
  const [colaboradores, setColaboradores] = useState([])
  const [ejemplos, setEjemplos] = useState(demoAsignacionesIniciales)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [estado, setEstado] = useState('ACTIVA')
  const [menuAbierto, setMenuAbierto] = useState(null)
  const [modal, setModal] = useState(null)
  const [porDesvincular, setPorDesvincular] = useState(null)
  const [formulario, setFormulario] = useState(formularioInicial)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setHistorialCompleto(false)
    setError('')
    if (!user?.usuarioId) {
      setError('No se pudo identificar al líder de proyecto.')
      setCargando(false)
      return
    }

    const [proyectosResp, colaboradoresResp] = await Promise.allSettled([
      proyectosService.list({ liderId: user.usuarioId }),
      colaboradoresService.listAll(),
    ])
    const listaProyectos = proyectosResp.status === 'fulfilled'
      ? extraer(proyectosResp.value).filter(item => item.liderId === user.usuarioId) : []
    const listaColaboradores = colaboradoresResp.status === 'fulfilled' ? extraer(colaboradoresResp.value) : []
    const personas = listaColaboradores.map(item => ({
      ...item,
      nombre: nombreColaborador(item),
      rol: item.rolProfesional || 'Colaborador',
    }))

    const respuestas = await Promise.allSettled(listaProyectos.map(item =>
      api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/asignaciones`)))
    const nombres = new Map(personas.map(item => [item.colaboradorId, item]))
    const filas = listaProyectos.flatMap((proyecto, indice) =>
      respuestas[indice]?.status === 'fulfilled'
        ? extraer(respuestas[indice].value).map(item => ({
          ...item,
          colaborador: nombres.get(item.colaboradorId)?.nombre ||
            'Colaborador ' + String(item.colaboradorId || '').slice(0, 8),
          rol: nombres.get(item.colaboradorId)?.rol || 'Colaborador',
        }))
        : [],
    )

    setProyectos(listaProyectos)
    setColaboradores(personas)
    setAsignaciones(filas)
    setHistorialCompleto(proyectosResp.status === 'fulfilled' &&
      respuestas.every(item => item.status === 'fulfilled'))
    if (proyectosResp.status === 'rejected') {
      setError(getApiErrorMessage(proyectosResp.reason, 'No se pudieron cargar los proyectos.'))
    } else if (respuestas.some(item => item.status === 'rejected')) {
      setError('No se pudieron consultar todas las asignaciones de tus proyectos.')
    } else if (colaboradoresResp.status === 'rejected') {
      setError('No se pudo cargar el catálogo de colaboradores.')
    }
    setCargando(false)
  }, [user?.usuarioId])

  useEffect(() => { cargar() }, [cargar])

  const mostrarEjemplos = import.meta.env.VITE_DEMO_MODE === 'true' && !cargando && !error
  const listaProyectos = mostrarEjemplos ? [...proyectos, ...demoProyectos] : proyectos
  const listaAsignaciones = mostrarEjemplos ? [...asignaciones, ...ejemplos] : asignaciones
  const listaPersonas = mostrarEjemplos ? [...colaboradores, ...demoPersonas] : colaboradores

  const activas = listaAsignaciones.filter(item => item.estado === 'ACTIVA')
  const resumen = {
    activas: activas.length,
    equipo: new Set(activas.map(item => item.colaboradorId)).size,
    asignadas: activas.reduce((total, item) => total + numero(item.horasAsignadas), 0),
    completadas: activas.reduce((total, item) => total + numero(item.horasCompletadas), 0),
  }

  const grupos = useMemo(() => {
    const terminos = [busqueda, busquedaSuperior].map(valor => valor.trim().toLocaleLowerCase('es'))
    return listaProyectos.map(proyecto => {
      const relacionadas = listaAsignaciones.filter(item => item.proyectoId === proyecto.proyectoId)
      const filas = relacionadas.filter(item =>
        (estado === 'TODOS' || item.estado === estado) &&
        terminos.every(texto =>
          [item.colaborador, item.rol, proyecto.nombre].join(' ').toLocaleLowerCase('es').includes(texto)))
      const coincideNombre = terminos.every(texto => proyecto.nombre.toLocaleLowerCase('es').includes(texto))
      const mostrarVacio = !filas.length && (estado === 'ACTIVA' || estado === 'TODOS') &&
         proyecto.estado === 'ACTIVO' && coincideNombre &&
         !relacionadas.some(item => item.estado === 'ACTIVA')
      if (!filas.length && !mostrarVacio) return null
      return { proyecto, filas }
    }).filter(Boolean)
  }, [listaProyectos, listaAsignaciones, busqueda, busquedaSuperior, estado])

  const abrirCrear = proyectoId => {
    setMenuAbierto(null)
    if (!historialCompleto) {
      setError('No se puede asignar hasta consultar el historial completo de los proyectos. Reintenta cargar los datos.')
      return
    }
    setErrorFormulario('')
    const disponibles = listaProyectos.filter(item => item.estado === 'ACTIVO')
    const proyectoSeleccionado = proyectoId || disponibles.find(hayCandidatosPara)?.proyectoId || disponibles[0]?.proyectoId || ''
    const proyecto = listaProyectos.find(item => item.proyectoId === proyectoSeleccionado)
    const candidatos = listaPersonas.filter(item => item.estado !== 'INACTIVO' &&
      esCandidatoAsignable(item, proyecto) &&
      !listaAsignaciones.some(asignacion => asignacion.proyectoId === proyectoSeleccionado &&
        asignacion.colaboradorId === item.colaboradorId))
    setFormulario({
      ...formularioInicial,
      proyectoId: proyectoSeleccionado,
      colaboradorId: candidatos[0]?.colaboradorId || '',
    })
    setModal({ tipo: 'crear' })
  }

  const abrirEditar = item => {
    setMenuAbierto(null)
    setErrorFormulario('')
    setFormulario({
      proyectoId: item.proyectoId,
      colaboradorId: item.colaboradorId,
      porcentajeDedicacion: String(item.porcentajeDedicacion ?? 0),
      horasAsignadas: String(item.horasAsignadas ?? 0),
      horasCompletadas: String(item.horasCompletadas ?? 0),
    })
    setModal({ tipo: 'editar', item })
  }

  const guardar = async evento => {
    evento.preventDefault()
    if (!modal || guardando) return
    if (modal.tipo === 'crear' && !historialCompleto) {
      setErrorFormulario('No se pudo verificar el historial completo de asignaciones. Recarga los datos antes de continuar.')
      return
    }
    const porcentajeDedicacion = Number(formulario.porcentajeDedicacion)
    const horasAsignadas = Number(formulario.horasAsignadas)
    const horasCompletadas = Number(formulario.horasCompletadas)
    if (!formulario.proyectoId || !formulario.colaboradorId ||
      !Number.isFinite(porcentajeDedicacion) || porcentajeDedicacion <= 0 || porcentajeDedicacion > 100 ||
      !Number.isFinite(horasAsignadas) || horasAsignadas <= 0 ||
      !Number.isFinite(horasCompletadas) || horasCompletadas < 0 || horasCompletadas > horasAsignadas) {
      setErrorFormulario('Selecciona proyecto y colaborador, una dedicación de 1 a 100 %, y horas válidas.')
      return
    }

    if (modal.tipo === 'crear' && listaAsignaciones.some(item =>
      item.proyectoId === formulario.proyectoId && item.colaboradorId === formulario.colaboradorId)) {
      setErrorFormulario('Este colaborador ya tiene una asignación registrada en el proyecto.')
      return
    }
    const proyecto = listaProyectos.find(item => item.proyectoId === formulario.proyectoId)
    const colaborador = listaPersonas.find(item => item.colaboradorId === formulario.colaboradorId)
    if (modal.tipo === 'crear' && !esCandidatoAsignable(colaborador, proyecto)) {
      setErrorFormulario('El líder no puede asignarse a su propio proyecto. Comprueba también que ambos perfiles tengan una identidad válida.')
      return
    }
    const esDemo = modal.item?.esEjemplo || proyecto?.esEjemplo || colaborador?.esEjemplo
    const cambios = { porcentajeDedicacion, horasAsignadas, horasCompletadas }
    setGuardando(true)
    setErrorFormulario('')
    try {
      if (esDemo) {
        if (modal.tipo === 'editar') {
          setEjemplos(actuales => actuales.map(item =>
            item.asignacionId === modal.item.asignacionId ? { ...item, ...cambios } : item))
        } else {
          setEjemplos(actuales => [...actuales, {
            ...cambios,
            asignacionId: '__demo_' + crypto.randomUUID(),
            proyectoId: formulario.proyectoId,
            colaboradorId: formulario.colaboradorId,
            colaborador: colaborador.nombre,
            rol: colaborador.rol || 'Colaborador',
            fechaInicio: new Date().toISOString(),
            estado: 'ACTIVA',
            esEjemplo: true,
          }])
        }
        setAviso('Cambio aplicado solo a los datos de ejemplo, sin modificar el backend.')
      } else if (modal.tipo === 'crear') {
        await asignacionesService.create({
          proyectoId: formulario.proyectoId,
          colaboradorId: formulario.colaboradorId,
          porcentajeDedicacion,
          horasAsignadas,
        })
        await cargar()
        setAviso('Asignación creada correctamente.')
      } else {
        await asignacionesService.update(modal.item.asignacionId, cambios)
        await cargar()
        setAviso('Asignación actualizada correctamente.')
      }
      setModal(null)
    } catch (fallo) {
      setErrorFormulario(getApiErrorMessage(fallo, 'No se pudo guardar la asignación.'))
    } finally {
      setGuardando(false)
    }
  }

  const finalizar = async item => {
    if (guardando || item.estado !== 'ACTIVA' ||
      !window.confirm('¿Finalizar esta asignación y liberar su dedicación?')) return
    setGuardando(true)
    setMenuAbierto(null)
    setError('')
    try {
      if (item.esEjemplo) {
        setEjemplos(actuales => actuales.map(actual =>
          actual.asignacionId === item.asignacionId ? { ...actual, estado: 'FINALIZADA' } : actual))
        setAviso('Finalización de ejemplo, sin modificar el backend.')
      } else {
        await asignacionesService.finish(item.asignacionId)
        await cargar()
        setAviso('Asignación finalizada. La dedicación del colaborador ha sido liberada.')
      }
    } catch (error_) {
      setError(getApiErrorMessage(error_, 'No se pudo finalizar la asignación.'))
    } finally {
      setGuardando(false)
    }
  }

  const desvincular = async () => {
    if (!porDesvincular || guardando) return
    setGuardando(true)
    setError('')
    try {
      if (porDesvincular.esEjemplo) {
        setEjemplos(actuales => actuales.map(item =>
          item.asignacionId === porDesvincular.asignacionId ? { ...item, estado: 'DESVINCULADA' } : item))
        setAviso('Desvinculación de ejemplo: no se modificó el backend.')
      } else {
        await asignacionesService.remove(porDesvincular.asignacionId)
        await cargar()
        setAviso('El colaborador fue desvinculado de este proyecto.')
      }
      setPorDesvincular(null)
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo desvincular la asignación.'))
    } finally {
      setGuardando(false)
    }
  }

  const opcionesProyectos = listaProyectos.filter(item => item.estado === 'ACTIVO')
  const hayCandidatosPara = proyecto => listaPersonas.some(persona =>
    persona.estado !== 'INACTIVO' && esCandidatoAsignable(persona, proyecto) &&
    !listaAsignaciones.some(asignacion => asignacion.proyectoId === proyecto.proyectoId &&
      asignacion.colaboradorId === persona.colaboradorId))
  const opcionesPersonas = listaPersonas.filter(item => item.estado !== 'INACTIVO' &&
    (modal?.tipo === 'editar' || esCandidatoAsignable(item,
      listaProyectos.find(proyecto => proyecto.proyectoId === formulario.proyectoId))) &&
    (modal?.tipo === 'editar' || !listaAsignaciones.some(asignacion =>
      asignacion.proyectoId === formulario.proyectoId && asignacion.colaboradorId === item.colaboradorId)))

  return (
    <div className="emp-dashboard lider-asignaciones-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de líder de proyecto">
            {menu.map(([nombre, ruta]) => (
              <NavLink key={ruta} to={ruta} end className={({ isActive }) =>
                'emp-sidebar-item' + (isActive ? ' active' : '')
              }>{nombre}</NavLink>
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
          <h1 className="emp-header-title">Asignaciones</h1>
          <div className="emp-header-right">
            <input className="emp-search" type="search" placeholder="Buscar..."
              aria-label="Buscar asignaciones desde el encabezado"
              value={busquedaSuperior} onChange={evento => setBusquedaSuperior(evento.target.value)} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content lider-asignaciones-content" aria-labelledby="lider-asignaciones-titulo">
          <div className="lider-asignaciones-heading">
            <h2 id="lider-asignaciones-titulo">Asignaciones de mis proyectos</h2>
            <button type="button" className="lider-asignaciones-primary" onClick={() => abrirCrear('')}
              disabled={cargando || guardando || !historialCompleto || !opcionesProyectos.some(hayCandidatosPara)}>
              <Plus size={16} aria-hidden="true" /> Nueva asignación
            </button>
          </div>

          <div className="lider-asignaciones-metrics">
            <div className="emp-card"><p className="emp-card-label">Asignaciones activas</p><p className="emp-card-value">{cargando ? '—' : resumen.activas}</p></div>
            <div className="emp-card"><p className="emp-card-label">Colaboradores en equipo</p><p className="emp-card-value">{cargando ? '—' : resumen.equipo}</p></div>
            <div className="emp-card"><p className="emp-card-label">Horas asignadas</p><p className="emp-card-value">{cargando ? '—' : resumen.asignadas}</p></div>
            <div className="emp-card"><p className="emp-card-label">Horas completadas</p><p className="emp-card-value">{cargando ? '—' : resumen.completadas}</p></div>
          </div>

          <section className="lider-asignaciones-filter-panel" aria-label="Filtrar asignaciones">
            <label className="lider-asignaciones-filter-field">
              <span>Buscar por colaborador</span>
              <span className="lider-asignaciones-search">
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="Nombre del colaborador..." value={busqueda}
                  onChange={evento => setBusqueda(evento.target.value)} />
              </span>
            </label>
            <label className="lider-asignaciones-filter-field">
              <span>Estado</span>
              <select value={estado} onChange={evento => setEstado(evento.target.value)}>
                <option value="ACTIVA">Estado: Activas</option>
                 <option value="TODOS">Todos los estados</option>
                
                <option value="FINALIZADA">Finalizada</option>
                <option value="DESVINCULADA">Desvinculada</option>
              </select>
            </label>
          </section>

          {error && <div className="lider-asignaciones-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={cargar} disabled={cargando}>Reintentar</button>
          </div>}
          {aviso && <p className="lider-asignaciones-aviso" role="status">{aviso}</p>}
          {mostrarEjemplos && <p className="lider-asignaciones-preview" role="status">
            Vista previa: los proyectos y colaboradores de ejemplo se muestran junto a los reales. Sus acciones no modifican el backend.
          </p>}

          {cargando ? <p className="lider-asignaciones-empty" role="status">Cargando asignaciones...</p> : (
            <div className="lider-asignaciones-grupos">
              {grupos.map(({ proyecto, filas }) => {
                const activasProyecto = listaAsignaciones.filter(item =>
                  item.proyectoId === proyecto.proyectoId && item.estado === 'ACTIVA')
                const horasProyecto = activasProyecto.reduce((suma, item) => suma + numero(item.horasAsignadas), 0)
                const horasRequeridas = numero(proyecto.horasRequeridas)
                return (
                  <article key={proyecto.proyectoId} className="lider-asignaciones-proyecto">
                    <div className="lider-asignaciones-project-header">
                      <div>
                        <h3>{proyecto.nombre} {proyecto.esEjemplo && <small>Ejemplo</small>}</h3>
                        <p>{rangoFechasProyecto(proyecto)}</p>
                      </div>
                      <div className="lider-asignaciones-project-summary">
                        <span className={'lider-asignaciones-state ' + (proyecto.estado === 'ACTIVO' ? 'activa' : 'finalizada')}>
                          {proyecto.estado === 'ACTIVO' ? 'Activo' : proyecto.estado?.charAt(0) + proyecto.estado?.slice(1).toLowerCase()}
                        </span>
                        <div className="lider-asignaciones-project-progress">
                          <strong>{horasProyecto} / {horasRequeridas || '—'} h</strong>
                          <div className="lider-asignaciones-barra"><span style={{ width: progreso(horasProyecto, horasRequeridas) + '%' }} /></div>
                        </div>
                      </div>
                    </div>

                    {filas.length ? <div className="lider-asignaciones-rows">
                      {filas.map(item => (
                        <div className="lider-asignaciones-member" key={item.asignacionId}>
                          <div className="lider-asignaciones-member-main">
                            <div className="lider-asignaciones-avatar" aria-hidden="true">{iniciales(item.colaborador)}</div>
                            <div className="lider-asignaciones-member-name">
                              <strong>{item.colaborador}</strong>
                              <small>{item.rol}{item.esEjemplo ? ' · Ejemplo' : ''}</small>
                            </div>
                            <div className="lider-asignaciones-member-metric">
                              <span>Dedicación</span><strong>{item.porcentajeDedicacion ?? '—'} %</strong>
                              <div className="lider-asignaciones-barra"><span style={{ width: progreso(item.porcentajeDedicacion, 100) + '%' }} /></div>
                            </div>
                            <div className="lider-asignaciones-member-metric">
                              <span>Horas completadas</span>
                              <strong>{numero(item.horasCompletadas)} / {numero(item.horasAsignadas)} h</strong>
                              <div className="lider-asignaciones-barra"><span style={{ width: progreso(item.horasCompletadas, numero(item.horasAsignadas)) + '%' }} /></div>
                            </div>
                            <div className="lider-asignaciones-start">
                              <span>Inicio</span>
                              <strong>{fecha(item.fechaInicio)}</strong>
                            </div>
                            <span className={'lider-asignaciones-state ' + (item.estado || '').toLowerCase()}>{nombreEstado(item.estado)}</span>
                            <div className="lider-asignaciones-member-actions">
                              <button type="button" className="lider-asignaciones-more"
                                aria-label={'Opciones de ' + item.colaborador}
                                aria-expanded={menuAbierto === item.asignacionId}
                                onClick={() => setMenuAbierto(actual => actual === item.asignacionId ? null : item.asignacionId)}>
                                <MoreHorizontal size={18} aria-hidden="true" />
                              </button>
                              {menuAbierto === item.asignacionId && (
                                <div className="lider-asignaciones-menu">
                                  {item.estado === 'ACTIVA' ? <>
                                    <button type="button" onClick={() => abrirEditar(item)}>
                                      <Pencil size={14} aria-hidden="true" /> Editar horas y dedicación
                                    </button>
                                    <button type="button" onClick={() => finalizar(item)} disabled={guardando}>
                                       <CheckCircle2 size={14} aria-hidden="true" /> Finalizar
                                     </button>
                                     <button type="button" className="lider-asignaciones-unlink" onClick={() => {
                                      setPorDesvincular(item)
                                      setMenuAbierto(null)
                                    }}>
                                      <Unlink2 size={14} aria-hidden="true" /> Desvincular
                                    </button>
                                  </> : <span className="lider-asignaciones-menu-muted">Sin acciones disponibles</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          {item.estado === 'ACTIVA' && (
                            <button type="button" className="lider-asignaciones-edit-link" onClick={() => abrirEditar(item)}>
                              <Pencil size={13} aria-hidden="true" /> Editar horas
                            </button>
                          )}
                        </div>
                      ))}
                    </div> : <div className="lider-asignaciones-no-members">
                      <p>Aún no hay colaboradores asignados</p>
                      <button type="button" className="lider-asignaciones-secondary"
                        disabled={proyecto.estado !== 'ACTIVO' || !hayCandidatosPara(proyecto)}
                        onClick={() => abrirCrear(proyecto.proyectoId)}>Asignar colaborador</button>
                    </div>}
                  </article>
                )
              })}
              {!grupos.length && <p className="lider-asignaciones-empty">No hay proyectos o asignaciones que coincidan con los filtros.</p>}
            </div>
          )}
          <MisParticipaciones />
        </section>
      </main>

      {modal && <div className="lider-asignaciones-overlay" onMouseDown={evento => {
        if (evento.target === evento.currentTarget && !guardando) setModal(null)
      }}>
        <form className="lider-asignaciones-dialog" role="dialog" aria-modal="true" aria-labelledby="lider-asignaciones-dialog-title" onSubmit={guardar}>
          <div className="lider-asignaciones-dialog-heading">
            <h2 id="lider-asignaciones-dialog-title">{modal.tipo === 'editar' ? 'Editar asignación' : 'Nueva asignación'}</h2>
            <button type="button" aria-label="Cerrar formulario" onClick={() => setModal(null)} disabled={guardando}><X size={18} /></button>
          </div>
          {errorFormulario && <p className="lider-asignaciones-form-error" role="alert">{errorFormulario}</p>}
          <label>Proyecto
            <select required value={formulario.proyectoId} disabled={guardando || modal.tipo === 'editar'}
              onChange={evento => {
                const nuevoProyecto = evento.target.value
                const proyecto = listaProyectos.find(item => item.proyectoId === nuevoProyecto)
                const candidato = listaPersonas.find(item => item.estado !== 'INACTIVO' &&
                  esCandidatoAsignable(item, proyecto) &&
                  !listaAsignaciones.some(asignacion => asignacion.proyectoId === nuevoProyecto &&
                    asignacion.colaboradorId === item.colaboradorId))
                setFormulario({ ...formulario, proyectoId: nuevoProyecto, colaboradorId: candidato?.colaboradorId || '' })
              }}>
              <option value="">Seleccionar proyecto</option>
              {(modal.tipo === 'editar' ? listaProyectos : opcionesProyectos).map(item => <option key={item.proyectoId} value={item.proyectoId}>{item.nombre}{item.esEjemplo ? ' (ejemplo)' : ''}</option>)}
            </select>
          </label>
          <label>Colaborador
            <select required value={formulario.colaboradorId} disabled={guardando || modal.tipo === 'editar'}
              onChange={evento => setFormulario({ ...formulario, colaboradorId: evento.target.value })}>
              <option value="">Seleccionar colaborador</option>
              {opcionesPersonas.map(item => <option key={item.colaboradorId} value={item.colaboradorId}>
                {item.nombre}{item.esEjemplo ? ' (ejemplo)' : item.nombre === 'Colaborador ' + item.colaboradorId ? '' : ' · ' + item.colaboradorId}
              </option>)}
            </select>
            {modal.tipo === 'crear' && !opcionesPersonas.length && (
              <span role="status">No hay colaboradores elegibles para este proyecto (se excluye a su líder y a quienes ya estuvieron asignados).</span>
            )}
          </label>
          <label>Dedicación (%)
            <input type="number" required min="1" max="100" step="1" value={formulario.porcentajeDedicacion}
              onChange={evento => setFormulario({ ...formulario, porcentajeDedicacion: evento.target.value })} />
          </label>
          <label>Horas asignadas
            <input type="number" required min="1" step="1" value={formulario.horasAsignadas}
              onChange={evento => setFormulario({ ...formulario, horasAsignadas: evento.target.value })} />
          </label>
          {modal.tipo === 'editar' && <label>Horas completadas
            <input type="number" required min="0" step="1" value={formulario.horasCompletadas}
              onChange={evento => setFormulario({ ...formulario, horasCompletadas: evento.target.value })} />
          </label>}
          {(modal.item?.esEjemplo ||
            listaProyectos.some(item => item.proyectoId === formulario.proyectoId && item.esEjemplo) ||
            listaPersonas.some(item => item.colaboradorId === formulario.colaboradorId && item.esEjemplo)) && (
            <p className="lider-asignaciones-preview">Vista previa: esta operación no se enviará al backend.</p>
          )}
          <div className="lider-asignaciones-dialog-actions">
            <button type="button" className="lider-asignaciones-secondary" onClick={() => setModal(null)} disabled={guardando}>Cancelar</button>
            <button type="submit" className="lider-asignaciones-primary"
              disabled={guardando || !formulario.proyectoId || !formulario.colaboradorId}>
              {guardando ? 'Guardando...' : 'Guardar asignación'}
            </button>
          </div>
        </form>
      </div>}

      {porDesvincular && <div className="lider-asignaciones-overlay" onMouseDown={evento => {
        if (evento.target === evento.currentTarget && !guardando) setPorDesvincular(null)
      }}>
        <section className="lider-asignaciones-dialog" role="alertdialog" aria-modal="true" aria-labelledby="lider-asignaciones-unlink-title">
          <div className="lider-asignaciones-dialog-heading">
            <h2 id="lider-asignaciones-unlink-title">¿Desvincular colaborador?</h2>
            <button type="button" aria-label="Cerrar confirmación" disabled={guardando} onClick={() => setPorDesvincular(null)}><X size={18} /></button>
          </div>
          <p>Se desvinculará a <strong>{porDesvincular.colaborador}</strong> de este proyecto.
            {porDesvincular.esEjemplo ? ' El cambio solo afectará a los ejemplos.' : ' El historial se conservará.'}
          </p>
          <div className="lider-asignaciones-dialog-actions">
            <button type="button" className="lider-asignaciones-secondary" disabled={guardando} onClick={() => setPorDesvincular(null)}>Volver</button>
            <button type="button" className="lider-asignaciones-danger" onClick={desvincular} disabled={guardando}>
              <Unlink2 size={16} aria-hidden="true" /> {guardando ? 'Desvinculando...' : 'Desvincular'}
            </button>
          </div>
        </section>
      </div>}
    </div>
  )
}
