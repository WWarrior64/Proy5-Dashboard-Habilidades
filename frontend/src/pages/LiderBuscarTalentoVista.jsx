import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Search, UserRound, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { cargosService } from '../services/cargos.service.js'
import { habilidadesService } from '../services/habilidades.service.js'
import { proyectosService } from '../services/proyectos.service.js'
import { asignacionesService } from '../services/asignaciones.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import { nombreColaborador } from '../utils/formatters.js'
import { esCandidatoAsignable } from '../utils/asignacionElegibilidad.js'
import api from '../services/api.js'
import './lider-buscar-talento.css'

const menu = [
  ['Dashboard', '/dashboards/lider'],
  ['Mis proyectos', '/proyectos'],
  ['Buscar talento', '/colaboradores'],
  ['Postulaciones', '/postulaciones'],
  ['Asignaciones', '/asignaciones'],
]

const ejemplos = [
  { colaboradorId: '__ejemplo_ana', nombre: 'Ana López', rolProfesional: 'Desarrolladora Frontend', cargo: 'Frontend', disponibilidad: 'DISPONIBLE', dedicacion: 0, coincidencia: 92, habilidades: [{ nombre: 'React', nivel: 'SENIOR' }, { nombre: 'JavaScript', nivel: 'SENIOR' }, { nombre: 'CSS', nivel: 'MID' }], esEjemplo: true },
  { colaboradorId: '__ejemplo_carlos', nombre: 'Carlos Méndez', rolProfesional: 'Desarrollador Backend', cargo: 'Backend', disponibilidad: 'PARCIAL', dedicacion: 50, coincidencia: 81, habilidades: [{ nombre: 'Java', nivel: 'SENIOR' }, { nombre: 'SQL', nivel: 'MID' }], esEjemplo: true },
  { colaboradorId: '__ejemplo_juan', nombre: 'Juan Pérez', rolProfesional: 'Desarrollador Backend', cargo: 'Backend', disponibilidad: 'DISPONIBLE', dedicacion: 25, coincidencia: 64, habilidades: [{ nombre: 'Node.js', nivel: 'JUNIOR' }, { nombre: 'SQL', nivel: 'JUNIOR' }], esEjemplo: true },
  { colaboradorId: '__ejemplo_valeria', nombre: 'Valeria Cruz', rolProfesional: 'Ingeniera Cloud', cargo: 'Cloud', disponibilidad: 'DISPONIBLE', dedicacion: 0, coincidencia: 58, habilidades: [{ nombre: 'AWS', nivel: 'SENIOR' }, { nombre: 'Python', nivel: 'MID' }], esEjemplo: true },
  { colaboradorId: '__ejemplo_diego', nombre: 'Diego Rivas', rolProfesional: 'Desarrollador Móvil', cargo: 'Móvil', disponibilidad: 'PARCIAL', dedicacion: 60, coincidencia: 47, habilidades: [{ nombre: 'Flutter', nivel: 'MID' }, { nombre: 'JavaScript', nivel: 'MID' }], esEjemplo: true },
  { colaboradorId: '__ejemplo_camila', nombre: 'Camila Ortiz', rolProfesional: 'Analista de datos', cargo: 'Datos', disponibilidad: 'NO_DISPONIBLE', dedicacion: 100, coincidencia: 35, habilidades: [{ nombre: 'SQL', nivel: 'SENIOR' }, { nombre: 'Power BI', nivel: 'MID' }], esEjemplo: true },
]

const proyectosEjemplo = [
  { proyectoId: '__ejemplo_proyecto_web', nombre: 'Sistema Web', estado: 'ACTIVO', requisitos: [{ nombre: 'React', nivelMinimo: 'MID' }, { nombre: 'SQL', nivelMinimo: 'JUNIOR' }] },
  { proyectoId: '__ejemplo_proyecto_portal', nombre: 'Portal de clientes', estado: 'ACTIVO', requisitos: [{ nombre: 'JavaScript', nivelMinimo: 'MID' }, { nombre: 'CSS', nivelMinimo: 'MID' }] },
  { proyectoId: '__ejemplo_proyecto_api', nombre: 'API empresarial', estado: 'ACTIVO', requisitos: [{ nombre: 'Node.js', nivelMinimo: 'JUNIOR' }, { nombre: 'SQL', nivelMinimo: 'MID' }] },
]

const niveles = { JUNIOR: 1, MID: 2, SENIOR: 3 }
const opcionesNivel = [
  { valor: '', nombre: 'Cualquier nivel' },
  { valor: 'JUNIOR', nombre: 'Junior' },
  { valor: 'MID', nombre: 'Mid' },
  { valor: 'SENIOR', nombre: 'Senior' },
]

function obtenerItems(respuesta) {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}

const normalizar = texto => String(texto || '').trim().toLocaleLowerCase('es')
const iniciales = nombre => String(nombre || 'C').trim().split(/\s+/).slice(0, 2).map(texto => texto.charAt(0)).join('').toUpperCase()
const nombreNivel = nivel => nivel ? (nivel === 'MID' ? 'Mid' : nivel.charAt(0) + nivel.slice(1).toLowerCase()) : ''

function tipoDisponibilidad(item) {
  if (item.estado === 'INACTIVO') return 'NO_DISPONIBLE'
  if (!item.esEjemplo) {
    if (!Number.isFinite(item.dedicacion)) return 'SIN_DATOS'
    if (item.dedicacion >= 100) return 'NO_DISPONIBLE'
    if (item.dedicacion > 0) return 'PARCIAL'
    return 'DISPONIBLE'
  }
  if (item.disponibilidad === 'PARCIAL') return 'PARCIAL'
  if (item.disponibilidad === 'NO_DISPONIBLE') return 'NO_DISPONIBLE'
  if (item.disponibilidad === 'ASIGNADA') {
    return item.dedicacion != null && item.dedicacion < 100 ? 'PARCIAL' : 'NO_DISPONIBLE'
  }
  return 'DISPONIBLE'
}

function nombreDisponibilidad(item) {
  const tipo = tipoDisponibilidad(item)
  return tipo === 'SIN_DATOS' ? 'Sin datos' : tipo === 'PARCIAL' ? 'Parcial' : tipo === 'NO_DISPONIBLE' ? 'No disponible' : 'Disponible'
}

export default function LiderBuscarTalentoVista() {
  const { user } = useAuth()
  const [colaboradores, setColaboradores] = useState([])
  const [habilidadesCatalogo, setHabilidadesCatalogo] = useState([])
  const [cargos, setCargos] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [requisitos, setRequisitos] = useState({})
  const [habilidadesColaboradores, setHabilidadesColaboradores] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [habilidadFiltro, setHabilidadFiltro] = useState('')
  const [nivelFiltro, setNivelFiltro] = useState('')
  const [disponibilidadFiltro, setDisponibilidadFiltro] = useState('')
  const [estadoPerfilFiltro, setEstadoPerfilFiltro] = useState('ACTIVO')
  const [cargoFiltro, setCargoFiltro] = useState('')
  const [proyectoFiltro, setProyectoFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const [detalle, setDetalle] = useState(null)
  const [asignar, setAsignar] = useState(null)
  const [proyectoAsignacion, setProyectoAsignacion] = useState('')
  const [dedicacionAsignacion, setDedicacionAsignacion] = useState('25')
  const [horasAsignacion, setHorasAsignacion] = useState('20')
  const [guardando, setGuardando] = useState(false)
  const [errorAsignacion, setErrorAsignacion] = useState('')
  const [aviso, setAviso] = useState('')
  const [demostracionAsignada, setDemostracionAsignada] = useState({})

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    const [listaColaboradores, listaHabilidades, listaCargos, listaProyectos] = await Promise.allSettled([
      colaboradoresService.listAll(),
      habilidadesService.listAll(),
      cargosService.list({ estado: 'ACTIVO', limit: 100 }),
      user?.usuarioId ? proyectosService.list({ liderId: user.usuarioId }) : Promise.resolve({ data: { datos: [] } }),
    ])

    const personas = listaColaboradores.status === 'fulfilled' ? obtenerItems(listaColaboradores.value) : []
    const habilidades = listaHabilidades.status === 'fulfilled' ? obtenerItems(listaHabilidades.value) : []
    const cargosDisponibles = listaCargos.status === 'fulfilled' ? obtenerItems(listaCargos.value) : []
    const proyectosDisponibles = listaProyectos.status === 'fulfilled'
      ? obtenerItems(listaProyectos.value).filter(item => item.liderId === user?.usuarioId) : []

    const nombresHabilidad = new Map(habilidades.map(item => [item.habilidadId, item.nombre]))
    const resultados = await Promise.allSettled([
      ...personas.map(item => colaboradoresService.listSkills(item.colaboradorId)),
      ...proyectosDisponibles.map(item => api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/habilidades`)),
    ])
    const relacionesPersonas = {}
    personas.forEach((item, indice) => {
      const resultado = resultados[indice]
      if (resultado?.status === 'fulfilled') {
        relacionesPersonas[item.colaboradorId] = obtenerItems(resultado.value).map(habilidad => ({
          nombre: nombresHabilidad.get(habilidad.habilidadId) || habilidad.nombre || habilidad.habilidadId,
          nivel: String(habilidad.nivel || 'JUNIOR').toUpperCase(),
        }))
      }
    })
    const relacionesProyectos = {}
    proyectosDisponibles.forEach((item, indice) => {
      const resultado = resultados[personas.length + indice]
      if (resultado?.status === 'fulfilled') {
        relacionesProyectos[item.proyectoId] = obtenerItems(resultado.value).map(habilidad => ({
          nombre: nombresHabilidad.get(habilidad.habilidadId) || habilidad.nombre || habilidad.habilidadId,
          nivelMinimo: String(habilidad.nivelMinimo || 'JUNIOR').toUpperCase(),
        }))
      }
    })

    setColaboradores(personas)
    setHabilidadesCatalogo(habilidades)
    setCargos(cargosDisponibles)
    setProyectos(proyectosDisponibles)
    setHabilidadesColaboradores(relacionesPersonas)
    setRequisitos(relacionesProyectos)
    if (listaColaboradores.status === 'rejected') {
      setError(getApiErrorMessage(listaColaboradores.reason, 'No se pudieron cargar los colaboradores.'))
    }
    setCargando(false)
  }, [user?.usuarioId])

  useEffect(() => { cargar() }, [cargar])

  // En desarrollo, los seis perfiles de ejemplo acompañan a los registros reales.
  const mostrarEjemplos = import.meta.env.VITE_DEMO_MODE === 'true' && !cargando && !error
  const proyectosDisponibles = mostrarEjemplos && proyectos.length === 0 ? proyectosEjemplo : proyectos
  const opcionesAsignacion = (asignar?.esEjemplo ? proyectosDisponibles : proyectos)
    .filter(item => item.estado === 'ACTIVO' && esCandidatoAsignable(asignar, item))
  const tieneProyectoAsignable = item => (item.esEjemplo ? proyectosDisponibles : proyectos)
    .some(proyecto => proyecto.estado === 'ACTIVO' && esCandidatoAsignable(item, proyecto))

  const tarjetas = useMemo(() => {
    const cargosPorId = new Map(cargos.map(item => [item.cargoId, item.nombre]))
    const reales = colaboradores.map(item => ({
      ...item,
      nombre: nombreColaborador(item),
      cargo: cargosPorId.get(item.cargoId) || item.cargoNombre || item.rolProfesional || 'Sin cargo',
      dedicacion: Number.isFinite(item.dedicacionReservada) ? item.dedicacionReservada : null,
      habilidades: habilidadesColaboradores[item.colaboradorId] ||
        (Array.isArray(item.habilidades) ? item.habilidades.map(h => typeof h === 'string' ? { nombre: h, nivel: '' } : {
          nombre: h.nombre || h.habilidadId, nivel: String(h.nivel || '').toUpperCase(),
        }) : []),
    }))
    if (!mostrarEjemplos) return reales
    const ficticios = ejemplos.map(item => {
      const dedicacionAdicional = demostracionAsignada[item.colaboradorId] || 0
      const dedicacion = Math.min(100, item.dedicacion + dedicacionAdicional)
      return { ...item, dedicacion, disponibilidad: dedicacion >= 100 ? 'NO_DISPONIBLE' :
        dedicacionAdicional > 0 ? 'PARCIAL' : item.disponibilidad }
    })
    return [...reales, ...ficticios]
  }, [mostrarEjemplos, demostracionAsignada, colaboradores, cargos, habilidadesColaboradores])

  const nombresHabilidades = useMemo(() => {
    const nombres = [...habilidadesCatalogo.map(item => item.nombre),
      ...tarjetas.flatMap(item => item.habilidades.map(h => h.nombre))]
    return Array.from(new Set(nombres.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'))
  }, [habilidadesCatalogo, tarjetas])

  const nombresCargos = useMemo(() => Array.from(new Set(
    tarjetas.map(item => item.cargo).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, 'es')), [tarjetas])

  const requisitosActivos = proyectoFiltro
    ? (proyectosDisponibles.find(item => item.proyectoId === proyectoFiltro)?.requisitos || requisitos[proyectoFiltro] || [])
    : []
  const requisitosFiltrados = habilidadFiltro
    ? [{ nombre: habilidadFiltro, nivelMinimo: nivelFiltro || 'JUNIOR' }]
    : requisitosActivos

  const coincidencia = item => {
    if (item.esEjemplo && !habilidadFiltro && !proyectoFiltro) return item.coincidencia
    if (!requisitosFiltrados.length) return null
    if (!item.habilidades?.length) return null
    const acertadas = requisitosFiltrados.filter(requisito =>
      item.habilidades.some(habilidad =>
        normalizar(habilidad.nombre) === normalizar(requisito.nombre) &&
        (niveles[habilidad.nivel] || 0) >= (niveles[nivelFiltro || requisito.nivelMinimo] || 1),
      ),
    ).length
    return Math.round(acertadas / requisitosFiltrados.length * 100)
  }

  const visibles = tarjetas.map(item => ({ ...item, puntuacion: coincidencia(item) })).filter(item => {
    const contenido = [item.nombre, item.rolProfesional, item.cargo, ...item.habilidades.map(h => h.nombre)]
      .join(' ').toLocaleLowerCase('es')
    const terminos = [busqueda, busquedaSuperior].map(texto => normalizar(texto))
    const cumpleHabilidad = !habilidadFiltro || item.habilidades.some(h =>
      normalizar(h.nombre) === normalizar(habilidadFiltro) && (niveles[h.nivel] || 0) >= (niveles[nivelFiltro] || 1))
    const cumpleNivel = !nivelFiltro || habilidadFiltro || item.habilidades.some(h => (niveles[h.nivel] || 0) >= niveles[nivelFiltro])
    return (estadoPerfilFiltro === 'TODOS' || (estadoPerfilFiltro === 'ACTIVO'
      ? item.estado !== 'INACTIVO' : item.estado === 'INACTIVO')) &&
      terminos.every(texto => contenido.includes(texto)) && cumpleHabilidad && cumpleNivel &&
      (!disponibilidadFiltro || tipoDisponibilidad(item) === disponibilidadFiltro) &&
      (!cargoFiltro || item.cargo === cargoFiltro)
  }).sort((a, b) => (b.puntuacion ?? -1) - (a.puntuacion ?? -1))

  // Los seis perfiles ficticios deben poder verse junto con los dos reales existentes.
  const porPagina = mostrarEjemplos ? 9 : 6
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visiblesPagina = visibles.slice((paginaActual - 1) * porPagina, paginaActual * porPagina)

  const cambiarFiltro = (actualizar, valor) => {
    actualizar(valor)
    setPagina(1)
  }

  const abrirAsignacion = colaborador => {
    setErrorAsignacion('')
    const opciones = (colaborador.esEjemplo ? proyectosDisponibles : proyectos)
      .filter(item => item.estado === 'ACTIVO' && esCandidatoAsignable(colaborador, item))
    setProyectoAsignacion(opciones.some(item => item.proyectoId === proyectoFiltro)
      ? proyectoFiltro : opciones[0]?.proyectoId || '')
    setDedicacionAsignacion('25')
    setHorasAsignacion('20')
    setAsignar(colaborador)
  }

  const confirmarAsignacion = async evento => {
    evento.preventDefault()
    if (!asignar) return
    const dedicacion = Number(dedicacionAsignacion)
    const horas = Number(horasAsignacion)
    if (!proyectoAsignacion || !Number.isFinite(dedicacion) || dedicacion <= 0 || dedicacion > 100 ||
      !Number.isFinite(horas) || horas <= 0) {
      setErrorAsignacion('Selecciona un proyecto activo, con dedicación de 1 a 100 % y horas mayores que cero.')
      return
    }
    if (!esCandidatoAsignable(asignar, proyectosDisponibles.find(item => item.proyectoId === proyectoAsignacion))) {
      setErrorAsignacion('El líder no puede asignarse como colaborador a su propio proyecto.')
      return
    }
    if (asignar.dedicacion != null && asignar.dedicacion + dedicacion > 100) {
      setErrorAsignacion('La dedicación acumulada no puede superar el 100 %.')
      return
    }
    setGuardando(true)
    setErrorAsignacion('')
    try {
      if (asignar.esEjemplo) {
        setDemostracionAsignada(actuales => ({
          ...actuales,
          [asignar.colaboradorId]: (actuales[asignar.colaboradorId] || 0) + dedicacion,
        }))
        setAviso('Asignación de ejemplo realizada solo en esta pantalla; no se guardó en el backend.')
      } else {
        await asignacionesService.create({
          colaboradorId: asignar.colaboradorId,
          proyectoId: proyectoAsignacion,
          porcentajeDedicacion: dedicacion,
          horasAsignadas: horas,
          creadoPor: user?.usuarioId,
        })
        setAviso('Asignación creada correctamente.')
        await cargar()
      }
      setAsignar(null)
    } catch (fallo) {
      setErrorAsignacion(getApiErrorMessage(fallo, 'No se pudo crear la asignación.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="emp-dashboard lider-talento-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de líder de proyecto">
            {menu.map(([texto, ruta]) => (
              <NavLink key={ruta} to={ruta} end className={({ isActive }) =>
                'emp-sidebar-item' + (isActive ? ' active' : '')
              }>{texto}</NavLink>
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
          <h1 className="emp-header-title">Buscar talento</h1>
          <div className="emp-header-right">
            <input type="search" className="emp-search" placeholder="Buscar..."
              aria-label="Buscar colaboradores desde el encabezado"
              value={busquedaSuperior} onChange={evento => cambiarFiltro(setBusquedaSuperior, evento.target.value)} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content lider-talento-content" aria-labelledby="lider-talento-titulo">
          <h2 id="lider-talento-titulo" className="lider-talento-heading">Encuentra tu próximo colaborador</h2>

          <section className="lider-talento-filtros" aria-label="Filtros para buscar talento">
            <div className="lider-talento-campos">
              <label>Buscar por nombre
                <div className="lider-talento-input-icon">
                  <Search size={15} aria-hidden="true" />
                  <input type="search" placeholder="Nombre del colaborador..." value={busqueda}
                    onChange={evento => cambiarFiltro(setBusqueda, evento.target.value)} />
                </div>
              </label>
              <label>Habilidad
                <select value={habilidadFiltro} onChange={evento => cambiarFiltro(setHabilidadFiltro, evento.target.value)}>
                  <option value="">Todas las habilidades</option>
                  {nombresHabilidades.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                </select>
              </label>
              <label>Nivel mínimo
                <select value={nivelFiltro} onChange={evento => cambiarFiltro(setNivelFiltro, evento.target.value)}>
                  {opcionesNivel.map(nivel => <option key={nivel.valor} value={nivel.valor}>{nivel.nombre}</option>)}
                </select>
              </label>
              <label>Disponibilidad
                <select value={disponibilidadFiltro} onChange={evento => cambiarFiltro(setDisponibilidadFiltro, evento.target.value)}>
                  <option value="">Todas</option>
                  <option value="DISPONIBLE">Disponible</option>
                  <option value="PARCIAL">Parcial</option>
                  <option value="NO_DISPONIBLE">No disponible</option>
                </select>
              </label>
              <label>Estado del colaborador
                 <select value={estadoPerfilFiltro} onChange={evento => cambiarFiltro(setEstadoPerfilFiltro, evento.target.value)}>
                   <option value="ACTIVO">Activos</option>
                   <option value="INACTIVO">Dados de baja</option>
                   <option value="TODOS">Todos los estados</option>
                 </select>
               </label>
               <label>Cargo
                <select value={cargoFiltro} onChange={evento => cambiarFiltro(setCargoFiltro, evento.target.value)}>
                  <option value="">Todos los cargos</option>
                  {nombresCargos.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                </select>
              </label>
            </div>
            <div className="lider-talento-proyecto-filtro">
              <label>Cargar requisitos desde un proyecto <span>(opcional)</span>
                <select value={proyectoFiltro} onChange={evento => cambiarFiltro(setProyectoFiltro, evento.target.value)}>
                  <option value="">Ningún proyecto seleccionado</option>
                  {proyectosDisponibles.map(item => <option key={item.proyectoId} value={item.proyectoId}>{item.nombre}</option>)}
                </select>
              </label>
              <p>Compara las habilidades del colaborador con los requisitos del proyecto.</p>
            </div>
          </section>

          {error && (
            <div className="lider-talento-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={cargar} disabled={cargando}>Reintentar</button>
            </div>
          )}
          {aviso && <div className="lider-talento-aviso" role="status">{aviso}</div>}
          {mostrarEjemplos && (
            <p className="lider-talento-preview" role="status">
              Los seis perfiles de ejemplo se muestran junto a los colaboradores reales para revisar el diseño. Sus asignaciones son simuladas y no se guardan en el backend.
            </p>
          )}

          <div className="lider-talento-resultados">
            <strong>Mostrando {visibles.length} colaboradores{mostrarEjemplos
              ? ` (${visibles.filter(item => !item.esEjemplo).length} reales · ${visibles.filter(item => item.esEjemplo).length} de ejemplo)`
              : ''}</strong>
            <span>Ordenados por mejor coincidencia</span>
          </div>

          {cargando ? (
            <p className="lider-talento-vacio" role="status">Cargando colaboradores...</p>
          ) : (
            <>
              <div className="lider-talento-grid">
                {visiblesPagina.map(item => {
                  const tipo = tipoDisponibilidad(item)
                  const asignable = tipo !== 'NO_DISPONIBLE' && tieneProyectoAsignable(item)
                  return (
                    <article className="lider-talento-card" key={item.colaboradorId}>
                      <div className="lider-talento-card-top">
                        <div className="lider-talento-avatar" aria-hidden="true">{iniciales(item.nombre)}</div>
                        <div className="lider-talento-identity">
                          <h3>{item.nombre}</h3>
                          <p>{item.rolProfesional || item.cargo}</p>
                          {item.esEjemplo && <small className="lider-talento-ejemplo-label">Perfil de ejemplo</small>}
                        </div>
                        <div className="lider-talento-match">
                          <strong>{item.puntuacion == null ? '—' : item.puntuacion + '%'}</strong>
                          <small>Coincidencia</small>
                        </div>
                      </div>
                      <div className="lider-talento-disponibilidad">
                        <span className={'lider-talento-status ' + tipo.toLowerCase()}>
                          <i aria-hidden="true" />{nombreDisponibilidad(item)}
                        </span>
                      </div>
                      <div className="lider-talento-dedicacion">
                        <span>Dedicación actual: {item.dedicacion == null ? 'Sin datos' : item.dedicacion + ' %'}</span>
                        <div className="lider-talento-barra" role="progressbar" aria-label={'Dedicación de ' + item.nombre}
                          aria-valuemin={0} aria-valuemax={100}
                          aria-valuenow={item.dedicacion == null ? undefined : item.dedicacion}>
                          {item.dedicacion != null && <span style={{ width: Math.max(0, Math.min(100, item.dedicacion)) + '%' }} />}
                        </div>
                      </div>
                      <div className="lider-talento-skills">
                        {item.habilidades.length ? item.habilidades.slice(0, 4).map((habilidad, indice) => (
                          <span className="lider-talento-tag" key={habilidad.nombre + indice}>
                            {habilidad.nombre}{habilidad.nivel ? ' · ' + nombreNivel(habilidad.nivel) : ''}
                          </span>
                        )) : <span className="lider-talento-muted">Sin habilidades registradas</span>}
                      </div>
                      <div className="lider-talento-card-actions">
                        <button type="button" className="lider-talento-ver" onClick={() => setDetalle(item)}>Ver perfil</button>
                        <button type="button" className="lider-talento-asignar" disabled={!asignable || guardando}
                          title={!asignable ? 'No hay disponibilidad o proyectos activos para asignar' : 'Asignar a proyecto'}
                          onClick={() => abrirAsignacion(item)}>Asignar a proyecto</button>
                      </div>
                    </article>
                  )
                })}
              </div>
              {!visibles.length && <p className="lider-talento-vacio">No se encontraron colaboradores con estos filtros.</p>}
              {totalPaginas > 1 && (
                <div className="lider-talento-paginacion">
                  <span>Página {paginaActual} de {totalPaginas}</span>
                  <div>
                    <button type="button" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1}>Anterior</button>
                    <button type="button" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual >= totalPaginas}>Siguiente</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {detalle && (
        <div className="lider-talento-overlay" onMouseDown={evento => { if (evento.target === evento.currentTarget) setDetalle(null) }}>
          <section className="lider-talento-modal" role="dialog" aria-modal="true" aria-labelledby="lider-talento-detalle-titulo">
            <div className="lider-talento-modal-heading">
              <h2 id="lider-talento-detalle-titulo">Perfil del colaborador</h2>
              <button type="button" aria-label="Cerrar perfil" onClick={() => setDetalle(null)}><X size={18} /></button>
            </div>
            <div className="lider-talento-modal-profile">
              <div className="lider-talento-avatar" aria-hidden="true">{iniciales(detalle.nombre)}</div>
              <div><strong>{detalle.nombre}</strong><p>{detalle.rolProfesional || detalle.cargo}</p></div>
            </div>
            <dl className="lider-talento-detalle-lista">
              <dt>Cargo</dt><dd>{detalle.cargo}</dd>
              <dt>Disponibilidad</dt><dd>{nombreDisponibilidad(detalle)}</dd>
              <dt>Dedicación actual</dt><dd>{detalle.dedicacion == null ? 'Sin datos' : detalle.dedicacion + '%'}</dd>
              <dt>Coincidencia</dt><dd>{detalle.puntuacion == null ? 'Sin requisitos seleccionados' : detalle.puntuacion + '%'}</dd>
            </dl>
            <h3 className="lider-talento-modal-subtitulo">Habilidades</h3>
            <div className="lider-talento-skills">
              {detalle.habilidades.length ? detalle.habilidades.map((habilidad, indice) => (
                <span className="lider-talento-tag" key={habilidad.nombre + indice}>
                  {habilidad.nombre}{habilidad.nivel ? ' · ' + nombreNivel(habilidad.nivel) : ''}
                </span>
              )) : <span className="lider-talento-muted">Sin habilidades registradas</span>}
            </div>
            <div className="lider-talento-modal-actions">
              <button type="button" className="lider-talento-ver" onClick={() => setDetalle(null)}>Cerrar</button>
              <button type="button" className="lider-talento-asignar"
                disabled={tipoDisponibilidad(detalle) === 'NO_DISPONIBLE' || !tieneProyectoAsignable(detalle)}
                onClick={() => { setDetalle(null); abrirAsignacion(detalle) }}>Asignar a proyecto</button>
            </div>
          </section>
        </div>
      )}

      {asignar && (
        <div className="lider-talento-overlay" onMouseDown={evento => { if (evento.target === evento.currentTarget && !guardando) setAsignar(null) }}>
          <form className="lider-talento-modal" role="dialog" aria-modal="true" aria-labelledby="lider-talento-asignacion-titulo"
            onSubmit={confirmarAsignacion}>
            <div className="lider-talento-modal-heading">
              <h2 id="lider-talento-asignacion-titulo">Asignar a proyecto</h2>
              <button type="button" aria-label="Cerrar formulario" disabled={guardando} onClick={() => setAsignar(null)}><X size={18} /></button>
            </div>
            <p className="lider-talento-modal-intro">Colaborador: <strong>{asignar.nombre}</strong></p>
            {asignar.esEjemplo && <p className="lider-talento-preview">Vista previa: esta asignación no se guardará en el backend.</p>}
            {errorAsignacion && <p className="lider-talento-form-error" role="alert">{errorAsignacion}</p>}
            <label>Proyecto activo
              <select value={proyectoAsignacion} required disabled={guardando}
                onChange={evento => setProyectoAsignacion(evento.target.value)}>
                <option value="">Seleccionar proyecto</option>
                {opcionesAsignacion.map(item => <option key={item.proyectoId} value={item.proyectoId}>{item.nombre}</option>)}
              </select>
            </label>
            <label>Dedicación (%)
              <input type="number" min="1" max="100" step="1" required value={dedicacionAsignacion}
                disabled={guardando} onChange={evento => setDedicacionAsignacion(evento.target.value)} />
            </label>
            <label>Horas asignadas
              <input type="number" min="1" step="1" required value={horasAsignacion}
                disabled={guardando} onChange={evento => setHorasAsignacion(evento.target.value)} />
            </label>
            <div className="lider-talento-modal-actions">
              <button type="button" className="lider-talento-ver" onClick={() => setAsignar(null)} disabled={guardando}>Cancelar</button>
              <button type="submit" className="lider-talento-asignar" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Confirmar asignación'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
