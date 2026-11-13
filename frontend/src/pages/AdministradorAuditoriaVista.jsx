import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ArrowUpRight, CirclePlus, LogIn, RefreshCw, Search, UserRound, X } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import api from '../services/api.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import { fetchAllPages } from '../utils/apiResponses.js'
import './administrador-auditoria.css'

const menu = [
  ['Dashboard', '/dashboards/administrador'],
  ['Usuarios', '/usuarios'],
  ['Roles y permisos', '/roles-permisos'],
  ['Configuración', '/configuracion'],
  ['Auditoría', '/auditoria'],
]

const tipos = {
  CREACION: { nombre: 'Creación', clase: 'creacion', Icono: CirclePlus },
  ACTUALIZACION: { nombre: 'Actualización', clase: 'actualizacion', Icono: RefreshCw },
  CAMBIO_ESTADO: { nombre: 'Cambio de estado', clase: 'estado', Icono: RefreshCw },
  INICIO_SESION: { nombre: 'Inicio de sesión', clase: 'sesion', Icono: LogIn },
}

const entidades = ['Usuarios', 'Proyectos', 'Colaboradores', 'Cargos', 'Habilidades', 'Postulaciones', 'Asignaciones', 'Administración']

// Ejemplos exclusivamente visuales, habilitados solo con VITE_DEMO_MODE=true.
const eventosEjemplo = [
  { id: 'ej-01', diasAtras: 0, hora: '11:10', usuario: 'Luis Pérez', entidad: 'Usuarios', tipo: 'INICIO_SESION', accion: 'inició sesión', descripcion: 'Inicio de sesión de usuario en la plataforma.', detalle: 'Acceso de demostración registrado para ilustrar la bitácora.' },
  { id: 'ej-02', diasAtras: 0, hora: '10:25', usuario: 'Luis Pérez', entidad: 'Proyectos', tipo: 'CREACION', accion: 'creó el proyecto App móvil', descripcion: 'Creación de un nuevo proyecto interno.', detalle: 'Proyecto de ejemplo: App móvil.' },
  { id: 'ej-03', diasAtras: 0, hora: '09:40', usuario: 'María Torres', entidad: 'Colaboradores', tipo: 'CAMBIO_ESTADO', accion: 'cambió el estado del colaborador Pedro Alvarado', descripcion: 'Cambio de estado de un perfil de colaborador.', detalle: 'Estado nuevo de ejemplo: Inactivo.' },
  { id: 'ej-04', diasAtras: 0, hora: '09:15', usuario: 'María Torres', entidad: 'Usuarios', tipo: 'INICIO_SESION', accion: 'inició sesión', descripcion: 'Inicio de sesión de usuario en la plataforma.', detalle: 'Acceso de demostración registrado para ilustrar la bitácora.' },
  { id: 'ej-05', diasAtras: 0, hora: '08:45', usuario: 'Carlos Méndez', entidad: 'Asignaciones', tipo: 'ACTUALIZACION', accion: 'actualizó las horas de una asignación en Sistema Web', descripcion: 'Modificación de horas completadas.', detalle: 'Asignación de ejemplo: Sistema Web.' },
  { id: 'ej-06', diasAtras: 0, hora: '08:10', usuario: 'Ana López', entidad: 'Habilidades', tipo: 'CREACION', accion: 'registró la habilidad Flutter', descripcion: 'Registro de una nueva habilidad.', detalle: 'Habilidad de ejemplo: Flutter.' },
  { id: 'ej-07', diasAtras: 1, hora: '16:20', usuario: 'María Torres', entidad: 'Colaboradores', tipo: 'CAMBIO_ESTADO', accion: 'dio de baja al colaborador Pedro Alvarado', descripcion: 'Cambio de disponibilidad del colaborador.', detalle: 'Estado previo de ejemplo: Activo.' },
  { id: 'ej-08', diasAtras: 1, hora: '11:05', usuario: 'María Torres', entidad: 'Habilidades', tipo: 'CREACION', accion: 'creó la habilidad Flutter', descripcion: 'Nueva habilidad en el catálogo.', detalle: 'Registro ilustrativo de habilidad.' },
  { id: 'ej-09', diasAtras: 1, hora: '08:20', usuario: 'Sofía Ramírez', entidad: 'Usuarios', tipo: 'INICIO_SESION', accion: 'inició sesión', descripcion: 'Acceso a la plataforma.', detalle: 'Inicio de sesión de demostración.' },
  { id: 'ej-10', diasAtras: 2, hora: '14:30', usuario: 'Luis Pérez', entidad: 'Postulaciones', tipo: 'ACTUALIZACION', accion: 'aceptó la postulación de Carlos Méndez para Portal de clientes', descripcion: 'Revisión de una solicitud de participación.', detalle: 'Decisión de ejemplo: Aceptada.' },
  { id: 'ej-11', diasAtras: 2, hora: '11:10', usuario: 'Ana López', entidad: 'Proyectos', tipo: 'ACTUALIZACION', accion: 'actualizó el proyecto Portal de clientes', descripcion: 'Modificación de información del proyecto.', detalle: 'Proyecto de ejemplo: Portal de clientes.' },
  { id: 'ej-12', diasAtras: 2, hora: '09:00', usuario: 'Carlos Méndez', entidad: 'Usuarios', tipo: 'INICIO_SESION', accion: 'inició sesión', descripcion: 'Acceso a la plataforma.', detalle: 'Inicio de sesión de demostración.' },
]

const formatoDia = fecha => {
  if (Number.isNaN(fecha.getTime())) return ''
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha)
  const parte = tipo => partes.find(item => item.type === tipo)?.value
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

function fechaAtras(dias) {
  const fecha = new Date()
  fecha.setUTCDate(fecha.getUTCDate() - dias)
  return formatoDia(fecha)
}

const fechaMostrada = cadena => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cadena || '')) return 'Fecha no disponible'
  const [anio, mes, dia] = cadena.split('-')
  return `${dia}/${mes}/${anio}`
}

function nombreGrupo(fecha) {
  if (fecha === fechaAtras(0)) return 'Hoy'
  if (fecha === fechaAtras(1)) return 'Ayer'
  return fechaMostrada(fecha)
}

const modoDemo = import.meta.env.VITE_DEMO_MODE === 'true'

export default function AdministradorAuditoriaVista() {
  const [actividad, setActividad] = useState([])
  const [cargando, setCargando] = useState(!modoDemo)
  const [error, setError] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [entidadFiltro, setEntidadFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [desde, setDesde] = useState(fechaAtras(30))
  const [hasta, setHasta] = useState(fechaAtras(0))
  const [limite, setLimite] = useState(6)
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    if (modoDemo) return undefined
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        const respuesta = await fetchAllPages(({ limit, cursor }) =>
          api.get('/administracion/auditoria', {
            params: { desde, hasta, limite: limit, ...(cursor && { cursor }) },
          }))
        const eventos = respuesta.data?.datos?.items
        if (!Array.isArray(eventos)) throw new Error('La API no devolvió una lista de actividad válida.')
        if (!cancelado) setActividad(eventos.map(item => {
          const fecha = new Date(item.fecha)
          const valida = !Number.isNaN(fecha.getTime())
          return {
            id: item.auditoriaId,
            momento: valida ? fecha.getTime() : 0,
            fecha: valida ? formatoDia(fecha) : '',
            hora: valida ? fecha.toLocaleTimeString('es-SV', {
              timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit',
            }) : '—',
            usuario: item.usuario || item.usuarioId || 'Identidad no disponible',
            usuarioId: item.usuarioId || null,
            entidad: item.entidad || 'Otros',
            tipo: tipos[item.tipo] ? item.tipo : 'ACTUALIZACION',
            accion: item.accion || 'realizó una operación',
            descripcion: item.descripcion || 'Operación autenticada.',
            detalle: item.detalle || 'Sin información complementaria',
          }
        }))
      } catch (err) {
        if (!cancelado) setError(getApiErrorMessage(err, 'No se pudo consultar la actividad.'))
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    void cargar()
    return () => { cancelado = true }
  }, [desde, hasta])

  const eventos = useMemo(() => modoDemo
    ? eventosEjemplo.map(item => ({ ...item, fecha: fechaAtras(item.diasAtras) }))
    : [...actividad], [actividad])
    .sort((a, b) => (b.momento || 0) - (a.momento || 0) ||
      (b.fecha + b.hora).localeCompare(a.fecha + a.hora))

  const hoy = fechaAtras(0)
  const eventosHoy = eventos.filter(item => item.fecha === hoy)
  const metricas = [
    { titulo: 'Eventos de hoy', valor: eventosHoy.length },
    { titulo: 'Inicios de sesión', valor: eventos.filter(item => item.tipo === 'INICIO_SESION').length },
    { titulo: 'Cambios de estado', valor: eventos.filter(item => item.tipo === 'CAMBIO_ESTADO').length },
    { titulo: 'Usuarios con actividad hoy', valor: new Set(eventosHoy.map(item => item.usuarioId || item.usuario)).size },
  ]

  const filtrados = useMemo(() => {
    const usuarioBuscado = busqueda.trim().toLocaleLowerCase('es')
    const textoGlobal = busquedaSuperior.trim().toLocaleLowerCase('es')
    return eventos.filter(item =>
      (!entidadFiltro || item.entidad === entidadFiltro) &&
      (!tipoFiltro || item.tipo === tipoFiltro) &&
      (!desde || item.fecha >= desde) && (!hasta || item.fecha <= hasta) &&
      (!usuarioBuscado || [item.usuario, item.usuarioId].join(' ').toLocaleLowerCase('es').includes(usuarioBuscado)) &&
      (!textoGlobal || [item.usuario, item.accion, item.entidad, item.descripcion, item.detalle]
        .join(' ').toLocaleLowerCase('es').includes(textoGlobal)),
    )
  }, [eventos, busqueda, busquedaSuperior, entidadFiltro, tipoFiltro, desde, hasta])

  const visibles = filtrados.slice(0, limite)
  const grupos = useMemo(() => {
    const mapa = new Map()
    visibles.forEach(item => {
      if (!mapa.has(item.fecha)) mapa.set(item.fecha, [])
      mapa.get(item.fecha).push(item)
    })
    return [...mapa.entries()]
  }, [visibles])

  const cambiarFiltro = (cambiar, valor) => {
    cambiar(valor)
    setLimite(6)
  }

  return (
    <div className="emp-dashboard admin-auditoria-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de administrador">
            {menu.map(([nombre, ruta]) => (
              <NavLink key={nombre} to={ruta} end className={({ isActive }) =>
                'emp-sidebar-item' + (isActive ? ' active' : '')
              }>{nombre}</NavLink>
            ))}
          </nav>
        </div>
        <div className="emp-sidebar-bottom">
          <span className="emp-sidebar-user">Administrador</span>
          <EmpleadoLogoutButton />
        </div>
      </aside>

      <main className="emp-main">
        <header className="emp-header">
          <h1 className="emp-header-title">Auditoría</h1>
          <div className="emp-header-right">
            <input className="emp-search" type="search" placeholder="Buscar..."
              value={busquedaSuperior} aria-label="Buscar en el historial desde el encabezado"
              onChange={evento => cambiarFiltro(setBusquedaSuperior, evento.target.value)} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content admin-auditoria-content" aria-label="Registro de auditoría">
          <p className="admin-auditoria-nota" role="status">
            {modoDemo
              ? 'Modo demostración: eventos y cifras de ejemplo.'
              : 'Bitácora de eventos autenticados desde su habilitación en AWS. Los eventos anteriores no pueden reconstruirse con un autor verificado.'}
            {cargando && <span> Consultando actividad...</span>}
            {error && <span role="alert"> {error}</span>}
          </p>

          <div className="admin-auditoria-metricas">
            {metricas.map(item => (
              <div className="emp-card" key={item.titulo}>
                <p className="emp-card-label">{item.titulo}</p>
                <p className="emp-card-value">{item.valor}</p>
              </div>
            ))}
          </div>

          <section className="admin-auditoria-filtros" aria-label="Filtros del historial">
            <label className="admin-auditoria-filtro admin-auditoria-filtro-usuario">
              <span>Usuario</span>
              <span className="admin-auditoria-input">
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="Buscar por usuario..." value={busqueda}
                  onChange={evento => cambiarFiltro(setBusqueda, evento.target.value)} />
              </span>
            </label>
            <label className="admin-auditoria-filtro">
              <span>Entidad</span>
              <select value={entidadFiltro} onChange={evento => cambiarFiltro(setEntidadFiltro, evento.target.value)}>
                <option value="">Todas las entidades</option>
                {entidades.map(entidad => <option key={entidad} value={entidad}>{entidad}</option>)}
              </select>
            </label>
            <label className="admin-auditoria-filtro">
              <span>Tipo de acción</span>
              <select value={tipoFiltro} onChange={evento => cambiarFiltro(setTipoFiltro, evento.target.value)}>
                <option value="">Todas las acciones</option>
                {Object.entries(tipos).map(([valor, tipo]) => (
                  <option value={valor} key={valor}>{tipo.nombre}</option>
                ))}
              </select>
            </label>
            <div className="admin-auditoria-filtro admin-auditoria-filtro-fecha">
              <span>Rango de fechas</span>
              <div className="admin-auditoria-fechas">
                <input type="date" aria-label="Fecha desde" value={desde} max={hasta || undefined}
                  onChange={evento => cambiarFiltro(setDesde, evento.target.value)} />
                <span aria-hidden="true">–</span>
                <input type="date" aria-label="Fecha hasta" value={hasta} min={desde || undefined}
                  onChange={evento => cambiarFiltro(setHasta, evento.target.value)} />
              </div>
            </div>
          </section>

          <section className="admin-auditoria-historial" aria-label="Línea de tiempo de eventos">
            <div className="admin-auditoria-leyenda" aria-label="Leyenda de tipos de acción">
              {Object.entries(tipos).map(([id, tipo]) => (
                <span key={id} className="admin-auditoria-leyenda-item">
                  <i className={'admin-auditoria-punto ' + tipo.clase} aria-hidden="true" />
                  {tipo.nombre}
                </span>
              ))}
            </div>

            <div className="admin-auditoria-grupos">
              {grupos.map(([fecha, items]) => (
                <section className="admin-auditoria-grupo" aria-label={'Eventos del ' + fechaMostrada(fecha)} key={fecha}>
                  <h2>{['Hoy', 'Ayer'].includes(nombreGrupo(fecha))
                    ? `${nombreGrupo(fecha)} – ${fechaMostrada(fecha)}` : fechaMostrada(fecha)}</h2>
                  <ol className="admin-auditoria-eventos">
                    {items.map(item => {
                      const tipo = tipos[item.tipo]
                      const Icono = tipo.Icono
                      return (
                        <li className="admin-auditoria-evento" key={item.id}>
                          <span className={'admin-auditoria-evento-icono ' + tipo.clase}>
                            <Icono size={15} aria-hidden="true" />
                          </span>
                          <div className="admin-auditoria-evento-contenido">
                            <p><strong>{item.usuario}</strong> {item.accion}</p>
                            <div className="admin-auditoria-evento-meta">
                              <span className="admin-auditoria-entidad">{item.entidad}</span>
                              <span>{item.hora}</span>
                              <span className="admin-auditoria-tipo-texto">{tipo.nombre}</span>
                              <button type="button" onClick={() => setDetalle(item)}>
                                Ver detalle <ArrowUpRight size={12} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              ))}
              {!grupos.length && <p className="admin-auditoria-vacio">No hay eventos disponibles que coincidan con los filtros.</p>}
            </div>
            <div className="admin-auditoria-pie">
              <p>Mostrando {visibles.length} de {filtrados.length} eventos</p>
              {visibles.length < filtrados.length && (
                <button type="button" onClick={() => setLimite(actual => actual + 6)}>Cargar más</button>
              )}
            </div>
          </section>
        </section>
      </main>

      {detalle && (
        <div className="admin-auditoria-overlay" onMouseDown={evento => {
          if (evento.currentTarget === evento.target) setDetalle(null)
        }}>
          <section className="admin-auditoria-modal" role="dialog" aria-modal="true"
            aria-labelledby="admin-auditoria-modal-title">
            <div className="admin-auditoria-modal-encabezado">
              <h2 id="admin-auditoria-modal-title">Detalle del evento</h2>
              <button type="button" aria-label="Cerrar detalle" onClick={() => setDetalle(null)}><X size={18} /></button>
            </div>
            <p className="admin-auditoria-modal-aviso">{modoDemo ? 'Evento de demostración.' : 'Evento guardado en DynamoDB con identidad autenticada por Cognito.'}</p>
            <dl>
              <dt>Usuario</dt><dd>{detalle.usuario}</dd>
              <dt>Entidad</dt><dd>{detalle.entidad}</dd>
              <dt>Tipo de acción</dt><dd>{tipos[detalle.tipo].nombre}</dd>
              <dt>Fecha</dt><dd>{fechaMostrada(detalle.fecha)}</dd>
              <dt>Hora</dt><dd>{detalle.hora}</dd>
              <dt>Acción</dt><dd>{detalle.accion}</dd>
              <dt>Descripción</dt><dd>{detalle.descripcion}</dd>
              <dt>Información adicional</dt><dd>{detalle.detalle}</dd>
            </dl>
            <div className="admin-auditoria-modal-pie">
              <button type="button" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
