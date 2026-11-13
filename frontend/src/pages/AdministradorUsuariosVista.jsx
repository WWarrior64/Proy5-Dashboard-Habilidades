import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CircleCheck, CircleMinus, Clock3, Ellipsis, Plus, Search, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import Modal from '../components/common/Modal.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import UsuarioForm from '../components/usuarios/UsuarioForm.jsx'
import { usuariosService } from '../services/usuarios.service.js'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import './administrador-usuarios.css'

const menu = [
  ['Dashboard', '/dashboards/administrador'],
  ['Usuarios', '/usuarios'],
  ['Roles y permisos', '/roles-permisos'],
  ['Configuración', '/configuracion'],
  ['Auditoría', '/auditoria'],
]

const roles = [
  { valor: 'EMPLEADO', nombre: 'Empleado', clase: 'empleado' },
  { valor: 'RRHH', nombre: 'RRHH', clase: 'rrhh' },
  { valor: 'LIDER_PROYECTO', nombre: 'Líder de proyecto', clase: 'lider' },
  { valor: 'ADMINISTRADOR', nombre: 'Administrador', clase: 'administrador' },
]

const extraer = respuesta => {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}

const nombreRol = rol => roles.find(item => item.valor === rol)?.nombre || rol || 'Sin rol'
const claseRol = rol => roles.find(item => item.valor === rol)?.clase || 'empleado'

const iniciales = nombre => String(nombre || 'U').trim().split(/\s+/)
  .slice(0, 2).map(palabra => palabra.charAt(0)).join('').toUpperCase()

function ultimoAcceso(usuario) {
  const dato = usuario.ultimoAcceso || usuario.fechaUltimoAcceso
  if (!dato) return 'No registrado'
  const fecha = new Date(dato)
  return Number.isNaN(fecha.getTime()) ? 'No registrado' : fecha.toLocaleString('es-SV', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/El_Salvador',
  })
}

export default function AdministradorUsuariosVista() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [usuariosCargando, setUsuariosCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [perfiles, setPerfiles] = useState(null)
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('ACTIVO')
  const [pagina, setPagina] = useState(1)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [usuarioEditar, setUsuarioEditar] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)

  const puedeGestionar = user?.rol === 'ADMINISTRADOR'

  const cargarUsuarios = useCallback(async () => {
    setUsuariosCargando(true)
    setError('')
    try {
      // Los filtros son locales: las tarjetas de métricas siempre resumen los mismos datos.
      const respuesta = await usuariosService.listAll()
      setUsuarios(extraer(respuesta))
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudieron cargar los usuarios.'))
    } finally {
      setUsuariosCargando(false)
    }
  }, [])

  useEffect(() => { cargarUsuarios() }, [cargarUsuarios])

  useEffect(() => {
    let cancelado = false
    colaboradoresService.listAll()
      .then(respuesta => {
        if (!cancelado) setPerfiles(new Set(extraer(respuesta).map(item => item.usuarioId).filter(Boolean)))
      })
      .catch(() => { if (!cancelado) setPerfiles(null) })
    return () => { cancelado = true }
  }, [])

  const filtrados = useMemo(() => {
    const terminos = [busqueda, busquedaSuperior].map(valor => valor.trim().toLocaleLowerCase('es'))
    return usuarios.filter(item => {
      const contenido = [item.nombre, item.email, nombreRol(item.rol)].join(' ').toLocaleLowerCase('es')
      return terminos.every(termino => contenido.includes(termino)) &&
        (!rolFiltro || item.rol === rolFiltro) && (estadoFiltro === 'TODOS' || item.estado === estadoFiltro)
    })
  }, [usuarios, busqueda, busquedaSuperior, rolFiltro, estadoFiltro])

  const cantidadPorPagina = 6
  const paginas = Math.max(1, Math.ceil(filtrados.length / cantidadPorPagina))
  const paginaActual = Math.min(pagina, paginas)
  const visibles = filtrados.slice((paginaActual - 1) * cantidadPorPagina, paginaActual * cantidadPorPagina)

  const activos = usuarios.filter(item => item.estado === 'ACTIVO').length
  const inactivos = usuarios.filter(item => item.estado === 'INACTIVO').length

  const filtrar = (actualizar, valor) => {
    actualizar(valor)
    setPagina(1)
    setMenuAbierto(null)
  }

  const abrirCrear = () => {
    setUsuarioEditar(null)
    setFormularioAbierto(true)
    setError('')
    setAviso('')
    setMenuAbierto(null)
  }

  const abrirEditar = item => {
    setUsuarioEditar(item)
    setFormularioAbierto(true)
    setError('')
    setAviso('')
    setMenuAbierto(null)
  }

  const guardar = async datos => {
    if (guardando) return
    setGuardando(true)
    setError('')
    setAviso('')
    try {
      if (usuarioEditar) {
        const cambios = {}
        if (datos.nombre !== usuarioEditar.nombre) cambios.nombre = datos.nombre
        if (Object.keys(cambios).length) await usuariosService.update(usuarioEditar.usuarioId, cambios)
        if (datos.rol !== usuarioEditar.rol) {
          await usuariosService.changeRole(usuarioEditar.usuarioId, { rol: datos.rol })
        }
      } else {
        await usuariosService.create(datos)
      }
      setFormularioAbierto(false)
      setUsuarioEditar(null)
      await cargarUsuarios()
      setAviso(usuarioEditar ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.')
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo guardar el usuario.'))
    } finally {
      setGuardando(false)
    }
  }

  const cambiarEstado = async () => {
    if (!confirmacion || guardando) return
    const nuevoEstado = confirmacion.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    setGuardando(true)
    setError('')
    setAviso('')
    try {
      await usuariosService.changeStatus(confirmacion.usuarioId, { activo: nuevoEstado === 'ACTIVO' })
      setConfirmacion(null)
      await cargarUsuarios()
      setAviso(nuevoEstado === 'ACTIVO' ? 'Usuario activado correctamente.' : 'Usuario desactivado correctamente.')
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo cambiar el estado del usuario.'))
      setConfirmacion(null)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="emp-dashboard admin-usuarios-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de administrador">
            {menu.map(([nombre, ruta]) => ruta ? (
              <NavLink key={nombre} to={ruta} end
                className={({ isActive }) => 'emp-sidebar-item' + (isActive ? ' active' : '')}>
                {nombre}
              </NavLink>
            ) : (
              <span key={nombre} className="emp-sidebar-item" aria-disabled="true" title="Próximamente" style={{ cursor: 'default' }}>
                {nombre}
              </span>
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
          <h1 className="emp-header-title">Usuarios</h1>
          <div className="emp-header-right">
            <input type="search" className="emp-search" placeholder="Buscar..."
              aria-label="Buscar usuarios desde la barra superior"
              value={busquedaSuperior} onChange={evento => filtrar(setBusquedaSuperior, evento.target.value)} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content admin-usuarios-content" aria-labelledby="admin-usuarios-titulo">
          <div className="admin-usuarios-heading">
            <h2 id="admin-usuarios-titulo">Usuarios</h2>
            {puedeGestionar && (
              <button type="button" className="admin-usuarios-primary" onClick={abrirCrear} disabled={guardando}>
                <Plus size={16} aria-hidden="true" /> Crear usuario
              </button>
            )}
          </div>

          <div className="admin-usuarios-metrics">
            <div className="emp-card">
              <p className="emp-card-label">Usuarios</p>
              <p className="emp-card-value">{usuariosCargando ? '—' : usuarios.length}</p>
              <UsersRound className="admin-usuarios-metric-icon" size={20} aria-hidden="true" />
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Activos</p>
              <p className="emp-card-value">{usuariosCargando ? '—' : activos}</p>
              <CircleCheck className="admin-usuarios-metric-icon" size={20} aria-hidden="true" />
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Inactivos</p>
              <p className="emp-card-value">{usuariosCargando ? '—' : inactivos}</p>
              <CircleMinus className="admin-usuarios-metric-icon" size={20} aria-hidden="true" />
            </div>
            <div className="emp-card">
              <p className="emp-card-label">Roles</p>
              <p className="emp-card-value">{usuariosCargando ? '—' : roles.length}</p>
              <ShieldCheck className="admin-usuarios-metric-icon" size={20} aria-hidden="true" />
            </div>
          </div>

          <div className="admin-usuarios-filtros">
            <div className="admin-usuarios-roles" aria-label="Filtrar usuarios por rol">
              <button type="button" className={!rolFiltro ? 'activo' : ''}
                aria-pressed={!rolFiltro} onClick={() => filtrar(setRolFiltro, '')}>
                Todos <span>{usuarios.length}</span>
              </button>
              {roles.map(rol => (
                <button key={rol.valor} type="button" aria-pressed={rolFiltro === rol.valor}
                  className={rolFiltro === rol.valor ? 'activo' : ''}
                  onClick={() => filtrar(setRolFiltro, rol.valor)}>
                  {rol.nombre} <span>{usuarios.filter(item => item.rol === rol.valor).length}</span>
                </button>
              ))}
            </div>
            <div className="admin-usuarios-filtros-derecha">
              <label className="admin-usuarios-search">
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="Buscar por nombre o correo..."
                  aria-label="Buscar usuarios por nombre o correo" value={busqueda}
                  onChange={evento => filtrar(setBusqueda, evento.target.value)} />
              </label>
              <select aria-label="Filtrar usuarios por estado" value={estadoFiltro}
                onChange={evento => filtrar(setEstadoFiltro, evento.target.value)}>
                <option value="ACTIVO">Estado: Activos</option>
                 <option value="TODOS">Todos los estados</option>
                
                <option value="INACTIVO">Inactivos</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="admin-usuarios-feedback admin-usuarios-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={cargarUsuarios} disabled={usuariosCargando}>Reintentar</button>
            </div>
          )}
          {aviso && <p className="admin-usuarios-feedback admin-usuarios-aviso" role="status">{aviso}</p>}

          {usuariosCargando ? (
            <p className="admin-usuarios-vacio" role="status">Cargando usuarios...</p>
          ) : (
            <>
              <div className="admin-usuarios-grid">
                {visibles.map(item => {
                  const activo = item.estado === 'ACTIVO'
                  const clase = claseRol(item.rol)
                  return (
                    <article className="admin-usuario-card" key={item.usuarioId}>
                      <div className="admin-usuario-identidad">
                        <div className={'admin-usuario-avatar ' + clase} aria-hidden="true">{iniciales(item.nombre)}</div>
                        <div className="admin-usuario-nombre">
                          <h3 title={item.nombre}>{item.nombre || 'Sin nombre'}</h3>
                          <p title={item.email}>{item.email || 'Correo no registrado'}</p>
                        </div>
                      </div>
                      <div className="admin-usuario-etiquetas">
                        <span className={'admin-usuario-rol ' + clase}>{nombreRol(item.rol)}</span>
                        <span className={'admin-usuario-estado ' + (activo ? 'activo' : 'inactivo')}>
                          {activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="admin-usuario-detalles">
                        <p><Clock3 size={14} aria-hidden="true" />
                          Último acceso: {ultimoAcceso(item)}
                        </p>
                        <p><CircleCheck size={14} aria-hidden="true" />
                          Perfil de colaborador: {perfiles === null ? 'Sin datos' : perfiles.has(item.usuarioId) ? 'Sí' : 'No'}
                        </p>
                      </div>
                      <div className="admin-usuario-acciones">
                        <button type="button" className="admin-usuario-editar" disabled={!puedeGestionar || guardando}
                          onClick={() => abrirEditar(item)}>Editar</button>
                        <div className="admin-usuario-menu-contenedor">
                          <button type="button" className="admin-usuario-menu-boton"
                            aria-label={'Opciones para ' + item.nombre}
                            title={'Opciones para ' + item.nombre}
                            aria-expanded={menuAbierto === item.usuarioId}
                            disabled={!puedeGestionar || guardando}
                            onClick={() => setMenuAbierto(actual => actual === item.usuarioId ? null : item.usuarioId)}>
                            <Ellipsis size={18} aria-hidden="true" />
                          </button>
                          {menuAbierto === item.usuarioId && (
                            <div className="admin-usuario-menu">
                              <button type="button" className={activo ? 'admin-usuario-desactivar' : ''}
                                onClick={() => { setConfirmacion(item); setMenuAbierto(null) }}>
                                {activo ? 'Desactivar usuario' : 'Activar usuario'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
              {!visibles.length && (
                <p className="admin-usuarios-vacio">No se encontraron usuarios con estos filtros.</p>
              )}
              <div className="admin-usuarios-paginacion">
                <span>Mostrando {visibles.length ? (paginaActual - 1) * cantidadPorPagina + 1 : 0}–{Math.min(paginaActual * cantidadPorPagina, filtrados.length)} de {filtrados.length} usuarios</span>
                <div className="admin-usuarios-paginas">
                  <button type="button" disabled={paginaActual === 1} onClick={() => { setPagina(actual => Math.max(1, actual - 1)); setMenuAbierto(null) }}
                    aria-label="Página anterior">‹</button>
                  {Array.from({ length: paginas }, (_, indice) => indice + 1)
                    .filter(numero => numero === 1 || numero === paginas || Math.abs(numero - paginaActual) <= 1)
                    .map((numero, indice, lista) => (
                      <span key={numero} className="admin-usuarios-numero-grupo">
                        {indice > 0 && numero - lista[indice - 1] > 1 && <span className="admin-usuarios-ellipsis">…</span>}
                        <button type="button" className={paginaActual === numero ? 'actual' : ''}
                          aria-current={paginaActual === numero ? 'page' : undefined}
                          onClick={() => { setPagina(numero); setMenuAbierto(null) }}>{numero}</button>
                      </span>
                    ))}
                  <button type="button" disabled={paginaActual >= paginas}
                    onClick={() => { setPagina(actual => Math.min(paginas, actual + 1)); setMenuAbierto(null) }}
                    aria-label="Página siguiente">›</button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <div className="admin-usuarios-modal-estilos">
        <Modal isOpen={formularioAbierto} title={usuarioEditar ? 'Editar usuario' : 'Crear usuario'}
          onClose={() => { if (!guardando) setFormularioAbierto(false) }}>
          <UsuarioForm key={usuarioEditar?.usuarioId || 'nuevo'} usuario={usuarioEditar}
            onSave={guardar} onCancel={() => setFormularioAbierto(false)}
            loading={guardando} mode={usuarioEditar ? 'edit' : 'create'} />
        </Modal>
        <ConfirmDialog isOpen={Boolean(confirmacion)}
          title={confirmacion?.estado === 'ACTIVO' ? '¿Desactivar usuario?' : '¿Activar usuario?'}
          message={confirmacion?.estado === 'ACTIVO'
            ? `¿Deseas desactivar a ${confirmacion?.nombre}? Perderá el acceso mientras esté inactivo.`
            : `¿Deseas reactivar a ${confirmacion?.nombre}?`}
          confirmLabel={confirmacion?.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
          cancelLabel="Volver" danger={confirmacion?.estado === 'ACTIVO'}
          onConfirm={cambiarEstado} onCancel={() => { if (!guardando) setConfirmacion(null) }} />
      </div>
    </div>
  )
}
