import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Eye, Pencil, Plus, Search, UserRound } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { asignacionesService } from '../services/asignaciones.service.js'
import { habilidadesService } from '../services/habilidades.service.js'
import api from '../services/api.js'
import './rrhh-proyectos.css'

const menu = [
  ['Dashboard', '/dashboards/rrhh'],
  ['Colaboradores', '/colaboradores'],
  ['Habilidades', '/habilidades'],
  ['Proyectos', '/proyectos'],
  ['Asignaciones', '/asignaciones'],
]

const estados = [
  ['BORRADOR', 'Borrador'],
  ['ACTIVO', 'Activo'],
  ['PAUSADO', 'Pausado'],
  ['COMPLETADO', 'Completado'],
  ['CANCELADO', 'Cancelado'],
]

const proyectosEjemplo = [
  { proyectoId: '__ejemplo_portal', nombre: 'Portal de clientes', lider: 'Luis Pérez', estado: 'ACTIVO', horasRequeridas: 80, horasAsignadas: 40, fechaInicio: '2026-11-01', fechaFin: '2026-12-15', habilidades: [{ nombre: 'React', nivel: 'Mid' }, { nombre: 'SQL', nivel: 'Mid' }], descripcion: 'Portal para la atención de clientes' },
  { proyectoId: '__ejemplo_api', nombre: 'API empresarial', lider: 'Marta Gómez', estado: 'ACTIVO', horasRequeridas: 60, horasAsignadas: 0, fechaInicio: '2026-11-10', fechaFin: '2026-12-20', habilidades: [{ nombre: 'Node.js', nivel: 'Mid' }, { nombre: 'AWS', nivel: 'Junior' }], descripcion: 'Servicios internos y API empresarial' },
  { proyectoId: '__ejemplo_web', nombre: 'Sistema Web', lider: 'Sofía Ramírez', estado: 'ACTIVO', horasRequeridas: 120, horasAsignadas: 30, fechaInicio: '2026-11-25', fechaFin: '2027-01-30', habilidades: [{ nombre: 'React', nivel: 'Mid' }, { nombre: 'SQL', nivel: 'Mid' }], descripcion: 'Sistema web interno' },
  { proyectoId: '__ejemplo_app', nombre: 'App móvil', lider: 'Luis Pérez', estado: 'ACTIVO', horasRequeridas: 100, horasAsignadas: 0, fechaInicio: '2026-11-15', fechaFin: '2027-01-31', habilidades: [{ nombre: 'Flutter', nivel: 'Mid' }], descripcion: 'Aplicación móvil multiplataforma' },
  { proyectoId: '__ejemplo_nube', nombre: 'Migración a la nube', lider: 'Marta Gómez', estado: 'PAUSADO', horasRequeridas: 130, horasAsignadas: 20, fechaInicio: '2026-10-05', fechaFin: '2027-02-28', habilidades: [{ nombre: 'AWS', nivel: 'Mid' }], descripcion: 'Migración de servicios a infraestructura cloud' },
]

const leerItems = respuesta => {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}

const nombreEstado = valor => estados.find(([clave]) => clave === valor)?.[1] || valor || 'Sin estado'
const fechaCorta = fecha => {
  if (!fecha || typeof fecha !== 'string') return '—'
  const [anio, mes, dia] = fecha.slice(0, 10).split('-')
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '—'
}
const numero = valor => typeof valor === 'number' && Number.isFinite(valor) ? valor : null

export default function RrhhProyectosVista({
  proyectos = [],
  lideres = [],
  loading,
  error,
  canManage,
  onCreate,
  onEdit,
  onDetails,
  onRetry,
}) {
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [lider, setLider] = useState('')
  const [habilidad, setHabilidad] = useState('')
  const [relaciones, setRelaciones] = useState({})
  const [nombresHabilidades, setNombresHabilidades] = useState({})
  const [asignaciones, setAsignaciones] = useState(null)

  useEffect(() => {
    let cancelado = false
    async function cargarRelacionados() {
      const [catalogo, horas, ...requisitos] = await Promise.allSettled([
        habilidadesService.list({ limit: 100 }),
        asignacionesService.list({}),
        ...proyectos.map(item => api.get(`/proyectos/${encodeURIComponent(item.proyectoId)}/habilidades`)),
      ])
      if (cancelado) return
      if (catalogo.status === 'fulfilled') {
        setNombresHabilidades(Object.fromEntries(leerItems(catalogo.value).map(item => [item.habilidadId, item.nombre])))
      }
      setAsignaciones(horas.status === 'fulfilled' ? leerItems(horas.value) : null)
      const resultado = {}
      proyectos.forEach((item, indice) => {
        const respuesta = requisitos[indice]
        if (respuesta?.status === 'fulfilled') {
          resultado[item.proyectoId] = leerItems(respuesta.value)
        }
      })
      setRelaciones(resultado)
    }
    cargarRelacionados()
    return () => { cancelado = true }
  }, [proyectos])

  // Vista previa exclusivamente en desarrollo, si la API aún no devuelve proyectos.
  const mostrandoEjemplo = import.meta.env.DEV && !loading && proyectos.length === 0
  const catalogo = useMemo(() => {
    if (mostrandoEjemplo) return proyectosEjemplo.map(item => ({ ...item, esEjemplo: true }))
    const liderPorId = new Map(lideres.map(item => [item.usuarioId || item.id, item.nombre || item.email || 'Sin nombre']))
    const horasPorProyecto = asignaciones === null ? null : asignaciones.reduce((acumulado, item) => {
      if (item.proyectoId && item.estado === 'ACTIVA') {
        acumulado[item.proyectoId] = (acumulado[item.proyectoId] || 0) + (numero(item.horasAsignadas) || 0)
      }
      return acumulado
    }, {})
    return proyectos.map(item => {
      const requisitos = relaciones[item.proyectoId]
      const habilidades = Array.isArray(requisitos)
        ? requisitos.map(relacion => ({
          nombre: nombresHabilidades[relacion.habilidadId] || relacion.nombre || relacion.habilidadId,
          nivel: relacion.nivelMinimo || '',
        }))
        : Array.isArray(item.habilidades)
          ? item.habilidades.map(h => typeof h === 'string' ? { nombre: h, nivel: '' } : { nombre: h.nombre || h.habilidadId || '', nivel: h.nivelMinimo || h.nivel || '' })
          : null
      return {
        ...item,
        lider: liderPorId.get(item.liderId) || item.liderNombre || 'Sin líder registrado',
        habilidades,
        horasAsignadas: horasPorProyecto === null ? null : (horasPorProyecto[item.proyectoId] || 0),
      }
    })
  }, [proyectos, lideres, relaciones, nombresHabilidades, asignaciones, mostrandoEjemplo])

  const lideresFiltro = useMemo(() => Array.from(new Set(catalogo.map(item => item.lider))).sort(), [catalogo])
  const habilidadesFiltro = useMemo(() => Array.from(new Set(
    catalogo.flatMap(item => (item.habilidades || []).map(h => h.nombre).filter(Boolean)),
  )).sort(), [catalogo])
  const visibles = useMemo(() => {
    const terminos = [busqueda, busquedaSuperior].map(texto => texto.trim().toLocaleLowerCase('es'))
    return catalogo.filter(item => {
      const contenido = [item.nombre, item.lider, item.descripcion, ...(item.habilidades || []).map(h => h.nombre)]
        .filter(Boolean).join(' ').toLocaleLowerCase('es')
      return terminos.every(termino => contenido.includes(termino)) &&
        (!estado || item.estado === estado) &&
        (!lider || item.lider === lider) &&
        (!habilidad || (item.habilidades || []).some(h => h.nombre === habilidad))
    })
  }, [catalogo, busqueda, busquedaSuperior, estado, lider, habilidad])

  const horasRequeridas = catalogo.reduce((total, item) => total + (numero(item.horasRequeridas) || 0), 0)
  const horasAsignadas = catalogo.some(item => item.horasAsignadas === null || item.horasAsignadas === undefined)
    ? null
    : catalogo.reduce((total, item) => total + (numero(item.horasAsignadas) || 0), 0)

  const mostrarDetalle = item => {
    onDetails({
      ...item,
      liderId: item.lider,
      habilidades: (item.habilidades || []).map(h => h.nombre),
    })
  }

  return (
    <div className="emp-dashboard rrhh-proyectos-page">
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
          <h1 className="emp-header-title">Proyectos</h1>
          <div className="emp-header-right">
            <input
              className="emp-search"
              type="search"
              aria-label="Buscar proyectos desde el encabezado"
              placeholder="Buscar..."
              value={busquedaSuperior}
              onChange={evento => setBusquedaSuperior(evento.target.value)}
            />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content rrhh-proyectos-content" aria-labelledby="rrhh-proyectos-title">
          <div className="rrhh-proyectos-heading">
            <h2 id="rrhh-proyectos-title">Proyectos</h2>
            {canManage && (
              <button className="rrhh-proyectos-add" type="button" onClick={onCreate} disabled={loading}>
                <Plus size={16} aria-hidden="true" /> Nuevo proyecto
              </button>
            )}
          </div>

          <div className="rrhh-proyectos-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Total de proyectos</p>
              <p className="emp-card-value">{catalogo.length}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Activos</p>
              <p className="emp-card-value">{catalogo.filter(item => item.estado === 'ACTIVO').length}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Horas requeridas</p>
              <p className="emp-card-value">{horasRequeridas}</p>
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Horas asignadas</p>
              <p className="emp-card-value">{horasAsignadas ?? '—'}</p>
            </div>
          </div>

          <section className="rrhh-proyectos-panel" aria-labelledby="rrhh-proyectos-lista-title">
            <div className="rrhh-proyectos-panel-header">
              <h3 id="rrhh-proyectos-lista-title">Listado de proyectos</h3>
              <div className="rrhh-proyectos-filters">
                <label className="rrhh-proyectos-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Buscar proyectos por nombre, líder o habilidad"
                    placeholder="Buscar proyecto..."
                    value={busqueda}
                    onChange={evento => setBusqueda(evento.target.value)}
                  />
                </label>
                <select aria-label="Filtrar por estado" value={estado} onChange={evento => setEstado(evento.target.value)}>
                  <option value="">Estado: Todos</option>
                  {estados.map(([clave, etiqueta]) => <option value={clave} key={clave}>{etiqueta}</option>)}
                </select>
                <select aria-label="Filtrar por líder" value={lider} onChange={evento => setLider(evento.target.value)}>
                  <option value="">Líder: Todos</option>
                  {lideresFiltro.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                </select>
                <select aria-label="Filtrar por habilidad" value={habilidad} onChange={evento => setHabilidad(evento.target.value)}>
                  <option value="">Habilidad: Todas</option>
                  {habilidadesFiltro.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                </select>
              </div>
            </div>

            {error && (
              <div className="rrhh-proyectos-feedback rrhh-proyectos-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={onRetry} disabled={loading}>Reintentar</button>
              </div>
            )}
            {mostrandoEjemplo && (
              <p className="rrhh-proyectos-preview" role="status">Vista previa: los proyectos y sus métricas son datos ficticios, no registros guardados.</p>
            )}

            {loading ? (
              <p className="rrhh-proyectos-feedback" role="status">Cargando proyectos...</p>
            ) : (
              <>
                <div className="rrhh-proyectos-table-scroll">
                  <table className="rrhh-proyectos-table">
                    <thead>
                      <tr>
                        <th>Proyecto</th>
                        <th>Líder</th>
                        <th>Habilidades requeridas</th>
                        <th>Horas asignadas / requeridas</th>
                        <th>Fechas</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map(item => {
                        const asignadas = numero(item.horasAsignadas)
                        const requeridas = numero(item.horasRequeridas)
                        const progreso = requeridas > 0 && asignadas !== null ? Math.min(100, Math.max(0, (asignadas / requeridas) * 100)) : 0
                        return (
                          <tr key={item.proyectoId}>
                            <td className="rrhh-proyectos-nombre">{item.nombre}</td>
                            <td>{item.lider}</td>
                            <td>
                              <div className="rrhh-proyectos-tags">
                                {item.habilidades?.length
                                  ? item.habilidades.map((h, indice) => (
                                    <span key={h.nombre + indice} className="rrhh-proyectos-tag">
                                      {h.nombre}{h.nivel ? <span> · {h.nivel.charAt(0).toUpperCase() + h.nivel.slice(1).toLowerCase()}</span> : null}
                                    </span>
                                  ))
                                  : <span className="rrhh-proyectos-muted">{item.habilidades === null ? '—' : 'Sin habilidades'}</span>}
                              </div>
                            </td>
                            <td>
                              <div className="rrhh-proyectos-hours">
                                <span>{asignadas ?? '—'} / {requeridas ?? '—'} h</span>
                                <div className="rrhh-proyectos-progress" role="progressbar" aria-label={'Horas cubiertas de ' + item.nombre} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso)}>
                                  <span style={{ width: progreso + '%' }} />
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="rrhh-proyectos-dates">
                                <span>{fechaCorta(item.fechaInicio)}</span>
                                <span>{fechaCorta(item.fechaFin)}</span>
                              </div>
                            </td>
                            <td>
                              <span className={'rrhh-proyectos-status ' + (item.estado || 'BORRADOR').toLowerCase()}>
                                {nombreEstado(item.estado)}
                              </span>
                            </td>
                            <td>
                              <div className="rrhh-proyectos-actions">
                                <button type="button" aria-label={'Ver detalles de ' + item.nombre} title={'Ver detalles de ' + item.nombre} onClick={() => mostrarDetalle(item)}>
                                  <Eye size={16} aria-hidden="true" />
                                </button>
                                {canManage && (
                                  <button type="button" aria-label={'Editar ' + item.nombre} title={item.esEjemplo ? 'Vista previa: no se puede editar' : 'Editar ' + item.nombre} disabled={loading || item.esEjemplo} onClick={() => onEdit(item)}>
                                    <Pencil size={16} aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {!visibles.length && (
                    <p className="rrhh-proyectos-feedback">No hay proyectos que coincidan con los filtros.</p>
                  )}
                </div>
                <p className="rrhh-proyectos-count">Mostrando {visibles.length} de {catalogo.length} proyectos{mostrandoEjemplo ? ' · datos de ejemplo' : ''}</p>
              </>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}
