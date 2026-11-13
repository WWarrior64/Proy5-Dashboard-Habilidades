import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Mail, Pencil, Search, UserRound, X } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { usuariosService } from '../services/usuarios.service.js'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { habilidadesService } from '../services/habilidades.service.js'
import { proyectosService } from '../services/proyectos.service.js'
import { asignacionesService } from '../services/asignaciones.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import { disponibilidadCalculada, porcentajeLibre } from '../utils/disponibilidad.js'
import api from '../services/api.js'
import './perfil.css'

const menuPorRol = {
  EMPLEADO: [
    ['Dashboard', '/dashboards/empleado'],
    ['Mis habilidades', '/habilidades'],
    ['Proyectos disponibles', '/proyectos'],
    ['Mis postulaciones', '/postulaciones'],
    ['Mis asignaciones', '/asignaciones'],
  ],
  RRHH: [
    ['Dashboard', '/dashboards/rrhh'],
    ['Colaboradores', '/colaboradores'],
    ['Habilidades', '/habilidades'],
    ['Proyectos', '/proyectos'],
    ['Asignaciones', '/asignaciones'],
  ],
  LIDER_PROYECTO: [
    ['Dashboard', '/dashboards/lider'],
    ['Mis proyectos', '/proyectos'],
    ['Buscar talento', '/colaboradores'],
    ['Postulaciones', '/postulaciones'],
    ['Asignaciones', '/asignaciones'],
  ],
  ADMINISTRADOR: [
    ['Dashboard', '/dashboards/administrador'],
    ['Usuarios', '/usuarios'],
    ['Roles y permisos', '/roles-permisos'],
    ['Configuración', '/configuracion'],
    ['Auditoría', '/auditoria'],
  ],
}

const nombreRol = {
  EMPLEADO: 'Empleado',
  RRHH: 'RRHH',
  LIDER_PROYECTO: 'Líder de proyecto',
  ADMINISTRADOR: 'Administrador',
}

const accesosPorRol = {
  EMPLEADO: [
    ['Mis habilidades', '/habilidades'],
    ['Proyectos disponibles', '/proyectos'],
    ['Mis postulaciones', '/postulaciones'],
  ],
  RRHH: [
    ['Gestionar colaboradores', '/colaboradores'],
    ['Catálogo de habilidades', '/habilidades'],
    ['Asignaciones', '/asignaciones'],
  ],
  LIDER_PROYECTO: [
    ['Mis proyectos', '/proyectos'],
    ['Buscar talento', '/colaboradores'],
    ['Revisar postulaciones', '/postulaciones'],
  ],
  ADMINISTRADOR: [
    ['Administrar usuarios', '/usuarios'],
    ['Roles y permisos', '/roles-permisos'],
    ['Configuración', '/configuracion'],
    ['Auditoría', '/auditoria'],
  ],
}

const extraer = respuesta => {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}

const nombreIniciales = nombre => String(nombre || 'U').trim().split(/\s+/).slice(0, 2)
  .map(palabra => palabra.charAt(0)).join('').toUpperCase()

const fechaCorta = valor => {
  if (!valor) return 'No registrada'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime())
    ? 'No registrada'
    : fecha.toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' })
}

const nombreEstadoProyecto = estado => ({
  ACTIVO: 'Activo', BORRADOR: 'Borrador', PAUSADO: 'Pausado',
  COMPLETADO: 'Completado', CANCELADO: 'Cancelado',
})[estado] || estado || 'Sin estado'

const disponibilidadTexto = estado => ({
  DISPONIBLE: 'Disponible para nuevos proyectos',
  PARCIAL: 'Disponibilidad parcial',
  ASIGNADA: 'Asignado',
  NO_DISPONIBLE: 'No disponible',
  SIN_DATOS: 'Sin datos',
})[estado] || 'No registrada'

export default function Perfil() {
  const { user } = useAuth()
  const rol = user?.rol || 'EMPLEADO'
  const menu = menuPorRol[rol] || menuPorRol.EMPLEADO
  const [perfil, setPerfil] = useState(user)
  const [datos, setDatos] = useState({
    cargando: true, colaborador: null, habilidades: null, proyectos: null,
    postulaciones: null, asignaciones: null, usuarios: null, colaboradores: null,
    catalogo: null, proyectosHabilidades: {},
  })
  const [avisoCarga, setAvisoCarga] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [busquedaTabla, setBusquedaTabla] = useState('')
  const [editar, setEditar] = useState(false)
  const [nombreEdicion, setNombreEdicion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => { setPerfil(user) }, [user])

  useEffect(() => {
    if (!user?.usuarioId) return undefined
    let cancelado = false

    const cargar = async () => {
      setDatos(actual => ({ ...actual, cargando: true }))
      setAvisoCarga('')
      const consultas = {
        cuenta: usuariosService.getMe(),
        colaboradores: rol === 'EMPLEADO'
          ? colaboradoresService.getMe().then(response => ({ data: { datos: { items: [response.data?.datos].filter(Boolean) } } }))
          : colaboradoresService.listAll(),
        proyectos: proyectosService.list(rol === 'LIDER_PROYECTO'
          ? { liderId: user.usuarioId } : { estado: 'ACTIVO' }),
      }
      if (rol === 'ADMINISTRADOR') consultas.usuarios = usuariosService.listAll()
      if (rol === 'RRHH') {
        consultas.catalogo = habilidadesService.listAll()
        consultas.asignaciones = asignacionesService.list({})
      }

      const nombres = Object.keys(consultas)
      const respuestas = await Promise.allSettled(Object.values(consultas))
      if (cancelado) return
      const resultado = Object.fromEntries(respuestas.map((respuesta, indice) =>
        [nombres[indice], respuesta.status === 'fulfilled' ? respuesta.value : null]))
      const listaColaboradores = resultado.colaboradores ? extraer(resultado.colaboradores) : null
      const colaborador = listaColaboradores?.find(item => item.usuarioId === user.usuarioId) || null
      const proyectos = resultado.proyectos ? extraer(resultado.proyectos)
        .filter(item => rol !== 'LIDER_PROYECTO' || item.liderId === user.usuarioId) : null

      if (resultado.cuenta?.data?.datos?.usuarioId) setPerfil(resultado.cuenta.data.datos)

      const secundarios = {}
      if (colaborador) {
        secundarios.habilidades = colaboradoresService.listSkills(colaborador.colaboradorId)
        secundarios.catalogo = habilidadesService.listAll()
        if (rol === 'EMPLEADO') {
          secundarios.postulaciones = api.get(`/colaboradores/${encodeURIComponent(colaborador.colaboradorId)}/postulaciones`)
          secundarios.asignaciones = api.get(`/colaboradores/${encodeURIComponent(colaborador.colaboradorId)}/asignaciones`)
        }
      }
      if (rol === 'LIDER_PROYECTO' && proyectos) {
        secundarios.postulacionesProyectos = Promise.allSettled(proyectos.map(item =>
          api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/postulaciones`)))
        secundarios.asignacionesProyectos = Promise.allSettled(proyectos.map(item =>
          api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/asignaciones`)))
      }
      if (rol === 'EMPLEADO' && proyectos?.length) {
        secundarios.requisitos = Promise.allSettled(proyectos.slice(0, 8).map(item =>
          api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/habilidades`)))
      }

      const claves = Object.keys(secundarios)
      const consultasSecundarias = await Promise.allSettled(Object.values(secundarios))
      if (cancelado) return
      const extra = Object.fromEntries(consultasSecundarias.map((respuesta, indice) =>
        [claves[indice], respuesta.status === 'fulfilled' ? respuesta.value : null]))

      const sumarPorProyecto = key => {
        if (!proyectos) return null
        if (!extra[key]) return proyectos.length ? null : []
        const respuestas = extra[key]
        if (respuestas.some(item => item.status === 'rejected')) return null
        return respuestas.flatMap(item => extraer(item.value))
      }

      const relacionesProyectos = {}
      if (extra.requisitos && proyectos) {
        proyectos.slice(0, 8).forEach((item, indice) => {
          if (extra.requisitos[indice].status === 'fulfilled') {
            relacionesProyectos[item.proyectoId] = extraer(extra.requisitos[indice].value)
          }
        })
      }

      const listaHabilidades = extra.habilidades ? extraer(extra.habilidades) : null
      const catalogo = extra.catalogo ? extraer(extra.catalogo)
        : resultado.catalogo ? extraer(resultado.catalogo) : null
      const nombresHabilidades = new Map((catalogo || []).map(item => [item.habilidadId, item.nombre]))
      const habilidades = listaHabilidades?.map(item => ({
        ...item,
        nombre: nombresHabilidades.get(item.habilidadId) || item.nombre || 'Habilidad sin nombre',
      })) ?? null

      const huboFallo = respuestas.some(item => item.status === 'rejected') ||
        consultasSecundarias.some(item => item.status === 'rejected') ||
        ['postulacionesProyectos', 'asignacionesProyectos', 'requisitos']
          .some(key => extra[key]?.some(item => item.status === 'rejected'))

      setDatos({
        cargando: false, colaborador, habilidades, proyectos,
        postulaciones: rol === 'LIDER_PROYECTO'
          ? sumarPorProyecto('postulacionesProyectos')
          : extra.postulaciones ? extraer(extra.postulaciones) : null,
        asignaciones: rol === 'LIDER_PROYECTO'
          ? sumarPorProyecto('asignacionesProyectos')
          : rol === 'EMPLEADO' ? extra.asignaciones ? extraer(extra.asignaciones) : null
            : resultado.asignaciones ? extraer(resultado.asignaciones) : null,
        usuarios: resultado.usuarios ? extraer(resultado.usuarios) : null,
        colaboradores: listaColaboradores,
        catalogo, proyectosHabilidades: relacionesProyectos,
      })
      if (huboFallo) setAvisoCarga('Algunos datos no pudieron consultarse. Se muestran solo las cifras disponibles.')
    }

    cargar()
    return () => { cancelado = true }
  }, [rol, user?.usuarioId])

  const metricas = useMemo(() => {
    const cantidad = lista => lista == null ? '—' : lista.length
    const proyectosActivos = datos.proyectos?.filter(item => item.estado === 'ACTIVO')
    if (rol === 'EMPLEADO') return [
      ['Habilidades registradas', datos.colaborador ? cantidad(datos.habilidades) : '—'],
      ['Proyectos disponibles', cantidad(proyectosActivos)],
      ['Postulaciones', cantidad(datos.postulaciones)],
      ['Asignaciones activas', datos.asignaciones
        ? datos.asignaciones.filter(item => item.estado === 'ACTIVA').length : '—'],
    ]
    if (rol === 'LIDER_PROYECTO') return [
      ['Mis proyectos', cantidad(datos.proyectos)],
      ['Proyectos activos', cantidad(proyectosActivos)],
      ['Postulaciones recibidas', cantidad(datos.postulaciones)],
      ['Asignaciones activas', datos.asignaciones
        ? datos.asignaciones.filter(item => item.estado === 'ACTIVA').length : '—'],
    ]
    if (rol === 'RRHH') return [
      ['Colaboradores', cantidad(datos.colaboradores)],
      ['Disponibles', datos.colaboradores
        ? datos.colaboradores.filter(item => disponibilidadCalculada(item) === 'DISPONIBLE').length : '—'],
      ['Proyectos activos', cantidad(proyectosActivos)],
      ['Asignaciones activas', cantidad(datos.asignaciones)],
    ]
    return [
      ['Usuarios', cantidad(datos.usuarios)],
      ['Usuarios activos', datos.usuarios
        ? datos.usuarios.filter(item => item.estado === 'ACTIVO').length : '—'],
      ['Proyectos activos', cantidad(proyectosActivos)],
      ['Roles', 4],
    ]
  }, [datos, rol])

  const proyectosVisibles = useMemo(() => {
    const termino = [busquedaSuperior, busquedaTabla].map(texto => texto.trim().toLocaleLowerCase('es'))
    const niveles = { JUNIOR: 1, MID: 2, SENIOR: 3 }
    const habilidadesNivel = new Map((datos.habilidades || []).map(habilidad => [
      habilidad.habilidadId, niveles[String(habilidad.nivel || '').toUpperCase()] || 0,
    ]))
    const proyectos = (datos.proyectos || []).map(item => {
      const requisitos = datos.proyectosHabilidades[item.proyectoId] || []
      const nombres = new Map((datos.catalogo || []).map(habilidad => [habilidad.habilidadId, habilidad.nombre]))
      const habilidadesRequeridas = requisitos.map(habilidad => nombres.get(habilidad.habilidadId) || habilidad.nombre || '—')
      const coincidencia = requisitos.length && datos.habilidades
        ? Math.round(requisitos.filter(habilidad =>
          (habilidadesNivel.get(habilidad.habilidadId) || 0) >= (niveles[String(habilidad.nivelMinimo || 'JUNIOR').toUpperCase()] || 1),
        ).length / requisitos.length * 100)
        : null
      return { ...item, habilidadesRequeridas, coincidencia }
    })
    return proyectos.filter(item => termino.every(texto =>
      [item.nombre, item.descripcion, ...item.habilidadesRequeridas].join(' ')
        .toLocaleLowerCase('es').includes(texto)))
      .sort((a, b) => (b.coincidencia ?? -1) - (a.coincidencia ?? -1))
      .slice(0, 8)
  }, [datos, busquedaSuperior, busquedaTabla])

  const puedeEditar = Boolean(perfil?.usuarioId)
  const abrirEditar = () => {
    setNombreEdicion(perfil?.nombre || '')
    setErrorEdicion('')
    setEditar(true)
  }

  const guardarNombre = async evento => {
    evento.preventDefault()
    const nombre = nombreEdicion.trim()
    if (!nombre || nombre.length > 150) {
      setErrorEdicion('Introduce un nombre de hasta 150 caracteres.')
      return
    }
    setGuardando(true)
    setErrorEdicion('')
    try {
      if (import.meta.env.VITE_DEMO_MODE !== 'true') {
        await usuariosService.update(perfil.usuarioId, { nombre })
      }
      setPerfil(actual => ({ ...actual, nombre }))
      setMensaje(import.meta.env.VITE_DEMO_MODE === 'true'
        ? 'Nombre cambiado solo en esta sesión de demostración.'
        : 'Nombre actualizado. La cuenta mostrará el cambio al volver a consultar el perfil.')
      setEditar(false)
    } catch (fallo) {
      setErrorEdicion(getApiErrorMessage(fallo, 'No se pudo actualizar el nombre.'))
    } finally {
      setGuardando(false)
    }
  }

  const accesosVisibles = (accesosPorRol[rol] || accesosPorRol.EMPLEADO)
    .filter(([nombre]) => nombre.toLocaleLowerCase('es').includes(busquedaSuperior.trim().toLocaleLowerCase('es')))
  const rolMostrado = nombreRol[rol] || 'Usuario'
  const nombreMostrado = perfil?.nombre || 'Usuario'
  const subtitulo = datos.colaborador?.rolProfesional || rolMostrado
  const hayHabilidades = datos.habilidades?.length > 0

  return (
    <div className="emp-dashboard perfil-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label={'Menú de ' + rolMostrado}>
            {menu.map(([nombre, ruta]) => (
              <NavLink key={ruta} to={ruta} end className={({ isActive }) =>
                'emp-sidebar-item' + (isActive ? ' active' : '')
              }>{nombre}</NavLink>
            ))}
          </nav>
        </div>
        <div className="emp-sidebar-bottom">
          <span className="emp-sidebar-user">{rolMostrado}</span>
          <EmpleadoLogoutButton />
        </div>
      </aside>

      <main className="emp-main">
        <header className="emp-header">
          <h1 className="emp-header-title">Perfil</h1>
          <div className="emp-header-right">
            <input className="emp-search" type="search" placeholder="Buscar..."
              aria-label="Buscar proyectos en el perfil" value={busquedaSuperior}
              onChange={evento => setBusquedaSuperior(evento.target.value)} />
            <div className="emp-user-icon" aria-label="Cuenta actual">
              <UserRound size={22} aria-hidden="true" />
            </div>
          </div>
        </header>

        <section className="emp-content perfil-content" aria-label="Perfil de la cuenta actual">
          {avisoCarga && <p className="perfil-aviso" role="status">{avisoCarga}</p>}
          {mensaje && <p className="perfil-exito" role="status">{mensaje}</p>}

          <div className="perfil-metricas" aria-label="Resumen de cuenta">
            {metricas.map(([titulo, valor]) => (
              <div key={titulo} className="emp-card">
                <p className="emp-card-label">{titulo}</p>
                <p className="emp-card-value">{datos.cargando ? '—' : valor}</p>
              </div>
            ))}
          </div>

          <section className="perfil-identidad" aria-labelledby="perfil-nombre">
            <div className="perfil-avatar" aria-hidden="true">{nombreIniciales(nombreMostrado)}</div>
            <div className="perfil-identidad-info">
              <div className="perfil-nombre-linea">
                <h2 id="perfil-nombre">{nombreMostrado}</h2>
                <span className="perfil-rol">{rolMostrado}</span>
              </div>
              <p className="perfil-profesion">{subtitulo}</p>
              <p><Mail size={14} aria-hidden="true" />{perfil?.email || perfil?.correo || 'Correo no registrado'}</p>
              <p><CalendarDays size={14} aria-hidden="true" />
                Incorporación: {fechaCorta(perfil?.fechaCreacion)}
              </p>
              <p><CheckCircle2 size={14} aria-hidden="true" />
                Cuenta: {perfil?.estado === 'ACTIVO' ? 'Activa' : perfil?.estado === 'INACTIVO' ? 'Inactiva' : 'Sin datos'}
              </p>
            </div>
            <button type="button" className="perfil-editar" title="Editar nombre de cuenta"
              aria-label="Editar nombre de cuenta" onClick={abrirEditar} disabled={!puedeEditar}>
              <Pencil size={18} aria-hidden="true" />
            </button>
          </section>

          {rol === 'EMPLEADO' ? (
            <>
              <section className="perfil-bloque" aria-labelledby="perfil-habilidades-titulo">
                <div className="perfil-bloque-heading">
                  <h2 id="perfil-habilidades-titulo">Habilidades registradas</h2>
                  <Link to="/habilidades">Mis habilidades</Link>
                </div>
                <div className="perfil-bloque-cuerpo">
                  <div className="perfil-skills">
                    {hayHabilidades ? datos.habilidades.map(item => (
                      <span className="perfil-skill" key={item.habilidadId}>
                        {item.nombre}{item.nivel ? ' · ' + item.nivel.charAt(0) + item.nivel.slice(1).toLowerCase() : ''}
                      </span>
                    )) : (
                      <span className="perfil-sin-datos">{datos.cargando
                        ? 'Cargando habilidades...'
                        : !datos.colaborador ? 'No hay un perfil de colaborador asociado a esta cuenta.'
                          : datos.habilidades === null ? 'No se pudieron consultar las habilidades.' : 'No hay habilidades registradas.'}</span>
                    )}
                  </div>
                  <p>Rol profesional: <strong>{datos.colaborador?.rolProfesional || 'No registrado'}</strong></p>
                  <p>Disponibilidad: <strong>{datos.colaborador
                    ? disponibilidadTexto(disponibilidadCalculada(datos.colaborador)) : 'No registrada'}</strong></p>
                  {datos.colaborador && <p>Capacidad libre: <strong>{porcentajeLibre(datos.colaborador) == null
                    ? 'Sin datos' : porcentajeLibre(datos.colaborador) + ' %'}</strong>
                    {' · '}Dedicación reservada: <strong>{Number.isFinite(datos.colaborador.dedicacionReservada)
                      ? datos.colaborador.dedicacionReservada + ' %' : 'Sin datos'}</strong></p>}
                  <p className="perfil-sin-datos">La disponibilidad se calcula a partir de las asignaciones. Se actualiza al asignar, finalizar o desvincular proyectos.</p>
                </div>
              </section>
              <section className="perfil-bloque" aria-labelledby="perfil-proyectos-titulo">
                <div className="perfil-bloque-heading">
                  <h2 id="perfil-proyectos-titulo">Oportunidades recomendadas</h2>
                  <label className="perfil-buscar">
                    <Search size={14} aria-hidden="true" />
                    <input type="search" placeholder="Buscar..." aria-label="Buscar oportunidades"
                      value={busquedaTabla} onChange={evento => setBusquedaTabla(evento.target.value)} />
                  </label>
                </div>
                <div className="perfil-tabla-contenedor">
                  <table className="perfil-tabla">
                    <thead><tr><th>Proyecto</th><th>Habilidades clave</th><th>Horas</th><th>Estado</th></tr></thead>
                    <tbody>
                      {proyectosVisibles.map(item => (
                        <tr key={item.proyectoId}>
                          <td>{item.nombre}</td>
                          <td>{item.habilidadesRequeridas.length
                            ? item.habilidadesRequeridas.slice(0, 4).join(', ') : 'Sin requisitos consultados'}</td>
                          <td>{item.horasRequeridas ?? '—'}</td>
                          <td><span className="perfil-estado">{nombreEstadoProyecto(item.estado)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!datos.cargando && !proyectosVisibles.length &&
                    <p className="perfil-vacio">{datos.proyectos === null
                      ? 'No se pudieron consultar los proyectos disponibles.'
                      : 'No hay proyectos disponibles que coincidan con la búsqueda.'}</p>}
                  {datos.cargando && <p className="perfil-vacio">Cargando proyectos...</p>}
                </div>
              </section>
            </>
          ) : (
            <>
              {datos.colaborador && (
                <section className="perfil-bloque" aria-labelledby="perfil-profesional-titulo">
                  <div className="perfil-bloque-heading"><h2 id="perfil-profesional-titulo">Información profesional</h2></div>
                  <div className="perfil-bloque-cuerpo">
                    <p>Rol profesional: <strong>{datos.colaborador.rolProfesional || 'No registrado'}</strong></p>
                    <p>Disponibilidad: <strong>{disponibilidadTexto(disponibilidadCalculada(datos.colaborador))}</strong></p>
                  </div>
                </section>
              )}
              <section className="perfil-bloque" aria-labelledby="perfil-accesos-titulo">
                <div className="perfil-bloque-heading">
                  <h2 id="perfil-accesos-titulo">Accesos de tu rol</h2>
                </div>
                <div className="perfil-accesos">
                  {accesosVisibles.map(([nombre, ruta]) => (
                    <Link to={ruta} key={ruta}>{nombre}</Link>
                  ))}
                  {!accesosVisibles.length && <span className="perfil-sin-datos">No hay accesos que coincidan con la búsqueda.</span>}
                </div>
              </section>
              {(rol === 'LIDER_PROYECTO' || rol === 'RRHH') && (
                <section className="perfil-bloque" aria-labelledby="perfil-gestion-titulo">
                  <div className="perfil-bloque-heading">
                    <h2 id="perfil-gestion-titulo">{rol === 'LIDER_PROYECTO' ? 'Mis proyectos' : 'Proyectos activos'}</h2>
                    <Link to="/proyectos">Ver proyectos</Link>
                  </div>
                  <div className="perfil-tabla-contenedor">
                    <table className="perfil-tabla">
                      <thead><tr><th>Proyecto</th><th>Horas</th><th>Estado</th></tr></thead>
                      <tbody>
                        {proyectosVisibles.map(item => (
                          <tr key={item.proyectoId}>
                            <td>{item.nombre}</td>
                            <td>{item.horasRequeridas ?? '—'}</td>
                            <td><span className="perfil-estado">{nombreEstadoProyecto(item.estado)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!datos.cargando && !proyectosVisibles.length &&
                      <p className="perfil-vacio">{datos.proyectos === null
                        ? 'No se pudieron consultar los proyectos.'
                        : 'No hay proyectos para mostrar.'}</p>}
                    {datos.cargando && <p className="perfil-vacio">Cargando proyectos...</p>}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </main>

      {editar && (
        <div className="perfil-overlay" onMouseDown={evento => {
          if (evento.target === evento.currentTarget && !guardando) setEditar(false)
        }}>
          <form className="perfil-modal" role="dialog" aria-modal="true"
            aria-labelledby="perfil-edicion-titulo" onSubmit={guardarNombre}>
            <div className="perfil-modal-heading">
              <h2 id="perfil-edicion-titulo">Editar perfil</h2>
              <button type="button" disabled={guardando} aria-label="Cerrar" onClick={() => setEditar(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p>Modifica el nombre que aparece en tu cuenta. El correo y el rol se administran por separado.</p>
            {errorEdicion && <p className="perfil-error" role="alert">{errorEdicion}</p>}
            <label>Nombre
              <input autoFocus required maxLength={150} value={nombreEdicion}
                onChange={evento => setNombreEdicion(evento.target.value)} disabled={guardando} />
            </label>
            <div className="perfil-modal-acciones">
              <button className="perfil-secundario" type="button" disabled={guardando}
                onClick={() => setEditar(false)}>Cancelar</button>
              <button className="perfil-primario" type="submit" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}