import BrandName from '../components/common/BrandName.jsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Eye, Pencil, UserRound, UsersRound, X } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { usuariosService } from '../services/usuarios.service.js'
import { administracionService } from '../services/administracion.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import { etiquetaCodigo, etiquetaRol } from '../utils/formatters.js'
import { resolverPoliticaAdministrativa } from '../utils/administracionPermisos.js'
import { useAutoDismiss } from '../hooks/useAutoDismiss.js'
import './administrador-roles-permisos.css'

const menu = [
  ['Dashboard', '/dashboards/administrador'],
  ['Usuarios', '/usuarios'],
  ['Roles y permisos', '/roles-permisos'],
  ['Configuración', '/configuracion'],
  ['Auditoría', '/auditoria'],
]

const { roles: rolesBase, permisos: permisosBase } = resolverPoliticaAdministrativa(null)

function extraer(respuesta) {
  const datos = respuesta?.data?.datos
  return Array.isArray(datos?.items) ? datos.items : Array.isArray(datos) ? datos : []
}

function textoBuscable(valor) {
  return String(valor || '').toLocaleLowerCase('es').trim()
}

export default function AdministradorRolesPermisosVista() {
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [usuariosCargados, setUsuariosCargados] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [permisos, setPermisos] = useState(permisosBase)
  const [roles, setRoles] = useState(rolesBase)
  const [busquedaSuperior, setBusquedaSuperior] = useState('')
  const [modal, setModal] = useState(null)
  const [formulario, setFormulario] = useState({ nombre: '', descripcion: '', seleccionados: [] })
  const [errorFormulario, setErrorFormulario] = useState('')
  const [confirmacion, setConfirmacion] = useState(null)
  const [detalleRol, setDetalleRol] = useState(null)
  const [detalleConsulta, setDetalleConsulta] = useState(null)
  const [aviso, setAviso] = useState('')
  useAutoDismiss(aviso, setAviso)
  const [guardando, setGuardando] = useState(false)
  const [configCargando, setConfigCargando] = useState(true)
  const [apiDisponible, setApiDisponible] = useState(false)

  useEffect(() => {
    let cancelado = false
    administracionService.getRolesPermisos()
      .then(respuesta => {
        if (cancelado) return
        const politica = resolverPoliticaAdministrativa(respuesta.data?.datos)
        setRoles(politica.roles)
        setPermisos(politica.permisos)
        setApiDisponible(politica.compatible)
        if (!politica.compatible) {
          setAviso('El servidor devuelve un catálogo antiguo o incompleto. Se muestran los ocho permisos y los cuatro roles predeterminados como referencia, no como confirmación de permisos efectivos. Actualiza el backend para editar.')
        } else {
          setAviso('')
        }
      })
      .catch(error_ => {
        if (!cancelado) {
          setApiDisponible(false)
          setAviso('Se muestran los permisos y roles predeterminados como referencia, sin confirmar la política guardada. ' +
            getApiErrorMessage(error_, 'La API administrativa no está disponible.'))
        }
      })
      .finally(() => { if (!cancelado) setConfigCargando(false) })
    return () => { cancelado = true }
  }, [])

  const cargarUsuarios = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const respuesta = await usuariosService.listAll()
      setUsuarios(extraer(respuesta))
      setUsuariosCargados(true)
    } catch (fallo) {
      setUsuariosCargados(false)
      setError(getApiErrorMessage(fallo, 'No se pudieron cargar los usuarios para contar los roles.'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarUsuarios() }, [cargarUsuarios])

  const termino = textoBuscable(busquedaSuperior)
  const permisosVisibles = useMemo(() => permisos.filter(permiso =>
    [permiso.nombre, etiquetaCodigo(permiso.nombre), permiso.descripcion, ...permiso.roles.map(id =>
      etiquetaRol(roles.find(rol => rol.id === id)?.nombre || id),
    )].some(dato => textoBuscable(dato).includes(termino)),
  ), [permisos, roles, termino])

  const rolesVisibles = useMemo(() => roles.filter(rol =>
    [rol.nombre, etiquetaRol(rol.nombre), rol.descripcion,
      ...permisos.filter(permiso => permiso.roles.includes(rol.id)).map(permiso => etiquetaCodigo(permiso.nombre)),
    ].some(dato => textoBuscable(dato).includes(termino)),
  ), [roles, permisos, termino])

  const abrirPermiso = permiso => {
    if (!permiso) return
    setModal({ tipo: 'permiso', id: permiso.id })
    setFormulario({
      nombre: permiso?.nombre || '',
      descripcion: permiso?.descripcion || '',
      seleccionados: [...(permiso?.roles || [])],
    })
    setErrorFormulario('')
  }

  const abrirRol = rol => {
    if (!rol) return
    setModal({ tipo: 'rol', id: rol.id })
    setFormulario({
      nombre: rol?.nombre || '',
      descripcion: rol?.descripcion || '',
      seleccionados: rol
        ? permisos.filter(permiso => permiso.roles.includes(rol.id)).map(permiso => permiso.id)
        : [],
    })
    setErrorFormulario('')
  }

  const alternarSeleccion = id => {
    setFormulario(actual => ({
      ...actual,
      seleccionados: actual.seleccionados.includes(id)
        ? actual.seleccionados.filter(item => item !== id)
        : [...actual.seleccionados, id],
    }))
  }

  const guardar = async evento => {
    evento.preventDefault()
    if (!modal || !modal.id || guardando || !apiDisponible) return
    let nuevosRoles = roles
    let nuevosPermisos = permisos
    const nombre = formulario.nombre.trim()
    const descripcion = formulario.descripcion.trim()
    if (!nombre || !descripcion) {
      setErrorFormulario('El nombre y la descripción son obligatorios.')
      return
    }

    if (modal?.tipo === 'permiso') {
      if (permisos.some(item => item.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es') && item.id !== modal.id)) {
        setErrorFormulario('Ya existe un permiso con ese nombre.')
        return
      }
      const actualizado = {
        id: modal.id || 'demo_permiso_' + Date.now(),
        nombre,
        descripcion,
        roles: formulario.seleccionados,
      }
      nuevosPermisos = modal.id
        ? permisos.map(item => item.id === modal.id ? actualizado : item)
        : [...permisos, actualizado]
    } else if (modal?.tipo === 'rol') {
      if (roles.some(item => item.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es') && item.id !== modal.id)) {
        setErrorFormulario('Ya existe un rol con ese nombre.')
        return
      }
      const anterior = roles.find(rol => rol.id === modal.id)
      const actualizado = {
        id: modal.id || 'demo_rol_' + Date.now(),
        nombre: anterior?.sistema ? anterior.nombre : nombre,
        descripcion,
        sistema: anterior?.sistema || false,
      }
      nuevosRoles = modal.id
        ? roles.map(item => item.id === modal.id ? actualizado : item)
        : [...roles, actualizado]
      nuevosPermisos = permisos.map(permiso => ({
        ...permiso,
        roles: formulario.seleccionados.includes(permiso.id)
          ? Array.from(new Set([...permiso.roles, actualizado.id]))
          : permiso.roles.filter(id => id !== actualizado.id),
      }));
    }

    setGuardando(true)
    setErrorFormulario('')
    try {
      const respuesta = await administracionService.saveRolesPermisos({ roles: nuevosRoles, permisos: nuevosPermisos })
      const politicaGuardada = resolverPoliticaAdministrativa(respuesta.data?.datos)
      if (!politicaGuardada.compatible) {
        throw new Error('El servidor no confirmó el catálogo oficial completo. Revisa la versión desplegada.')
      }
      setRoles(politicaGuardada.roles)
      setPermisos(politicaGuardada.permisos)
      window.dispatchEvent(new Event('internal-marketplace-permissions-updated'))
      setModal(null)
      setAviso('Permisos operativos actualizados. Las nuevas restricciones se aplican en las operaciones de escritura del backend desplegado.')
    } catch (error_) {
      setErrorFormulario(getApiErrorMessage(error_, 'No se pudieron guardar los roles y permisos.'))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!confirmacion || guardando || !apiDisponible) return
    if (confirmacion.tipo === 'rol' && roles.find(item => item.id === confirmacion.id)?.sistema) {
      setAviso('No se puede eliminar un rol fundamental del sistema.')
      setConfirmacion(null)
      return
    }
    const nuevosRoles = confirmacion.tipo === 'rol'
      ? roles.filter(item => item.id !== confirmacion.id) : roles
    const nuevosPermisos = confirmacion.tipo === 'permiso'
      ? permisos.filter(item => item.id !== confirmacion.id)
      : permisos.map(item => ({
        ...item, roles: item.roles.filter(id => id !== confirmacion.id),
      }))
    setGuardando(true)
    setError('')
    try {
      await administracionService.saveRolesPermisos({ roles: nuevosRoles, permisos: nuevosPermisos })
      setRoles(nuevosRoles)
      setPermisos(nuevosPermisos)
      if (detalleRol?.id === confirmacion.id) setDetalleRol(null)
      setConfirmacion(null)
      setAviso('Elemento eliminado de la información administrativa. La autorización real no cambió.')
    } catch (error_) {
      setError(getApiErrorMessage(error_, 'No se pudo eliminar el elemento.'))
    } finally {
      setGuardando(false)
    }
  }

  const usuariosDelRol = detalleRol ? usuarios.filter(usuario => usuario.rol === detalleRol.id) : []

  return (
    <div className="emp-dashboard admin-rp-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand"><BrandName /></div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu" aria-label="Menú de administrador">
            {menu.map(([nombre, ruta]) => ruta ? (
              <NavLink key={nombre} to={ruta} end className={({ isActive }) =>
                'emp-sidebar-item' + (isActive ? ' active' : '')
              }>{nombre}</NavLink>
            ) : (
              <span key={nombre} className="emp-sidebar-item" title="Próximamente"
                aria-disabled="true" style={{ cursor: 'default' }}>{nombre}</span>
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
          <h1 className="emp-header-title">Roles y permisos</h1>
          <div className="emp-header-right">
            <input className="emp-search" type="search" placeholder="Buscar..."
              aria-label="Buscar roles y permisos" value={busquedaSuperior}
              onChange={evento => setBusquedaSuperior(evento.target.value)} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content admin-rp-content" aria-label="Administración de roles y permisos">
          <p className="admin-rp-nota" role="status">
            Los cuatro roles corresponden a las identidades reales del sistema. Puedes restringir o restablecer
            sus permisos operativos dentro de los límites permitidos por el backend. No se pueden conceder funciones
            fuera del rol, cambiar la propiedad de recursos ni desactivar las facultades esenciales del Administrador.
            El rol de cada cuenta se asigna desde la pantalla de Usuarios.
          </p>
          {error && (
            <div className="admin-rp-feedback" role="alert">
              <span>{error}</span>
              <button type="button" onClick={cargarUsuarios} disabled={cargando}>Reintentar</button>
            </div>
          )}
          {configCargando && <p className="admin-rp-aviso" role="status">Consultando información administrativa...</p>}
          {aviso && <p className="admin-rp-aviso" role="status">{aviso}</p>}

          <section className="admin-rp-seccion" aria-labelledby="admin-rp-permisos">
            <div className="admin-rp-seccion-heading">
              <h2 id="admin-rp-permisos">Permisos operativos</h2>
            </div>
            <div className="admin-rp-lista">
              {permisosVisibles.map(permiso => (
                <article className="admin-rp-item" key={permiso.id}>
                  <div className="admin-rp-item-info">
                    <h3>{etiquetaCodigo(permiso.nombre)}</h3>
                    <p>{permiso.descripcion}</p>
                    <div className="admin-rp-chips">
                      {permiso.roles.length ? permiso.roles.map(id => (
                        <span key={id} className="admin-rp-chip">{etiquetaRol(roles.find(rol => rol.id === id)?.nombre || id)}</span>
                      )) : <span className="admin-rp-muted">Sin roles asociados</span>}
                    </div>
                  </div>
                  <div className="admin-rp-acciones">
                    {apiDisponible && permiso.rolesPermitidos.some(id => id !== 'ADMINISTRADOR') ? (
                      <button type="button" className="admin-rp-icono" title={'Configurar ' + permiso.nombre}
                        aria-label={'Configurar ' + permiso.nombre} onClick={() => abrirPermiso(permiso)} disabled={guardando}>
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    ) : (
                      <button type="button" className="admin-rp-icono usuarios" title={'Consultar ' + permiso.nombre}
                        aria-label={'Consultar ' + permiso.nombre} onClick={() => setDetalleConsulta({ tipo: 'permiso', item: permiso })}>
                        <Eye size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {!permisosVisibles.length && <p className="admin-rp-sin-resultados">No se encontraron permisos.</p>}
            </div>
          </section>

          <section className="admin-rp-seccion" aria-labelledby="admin-rp-roles">
            <div className="admin-rp-seccion-heading">
              <h2 id="admin-rp-roles">Roles del sistema</h2>
            </div>
            <div className="admin-rp-lista">
              {rolesVisibles.map(rol => {
                const cantidad = usuarios.filter(usuario => usuario.rol === rol.id).length
                const relacionados = permisos.filter(permiso => permiso.roles.includes(rol.id))
                return (
                  <article className="admin-rp-item" key={rol.id}>
                    <div className="admin-rp-item-info">
                      <div className="admin-rp-titulo-rol">
                        <h3>{etiquetaRol(rol.nombre)}</h3>
                        <span className="admin-rp-cantidad">{usuariosCargados ? cantidad + ' usuarios' : cargando ? 'Cargando...' : 'Sin datos'}</span>
                      </div>
                      <p>{rol.descripcion}</p>
                      <div className="admin-rp-chips">
                        {relacionados.length ? relacionados.map(permiso => (
                          <span className="admin-rp-chip" key={permiso.id}>{etiquetaCodigo(permiso.nombre)}</span>
                        )) : <span className="admin-rp-muted">Sin operaciones de escritura habilitadas</span>}
                      </div>
                    </div>
                    <div className="admin-rp-acciones">
                      <button type="button" className="admin-rp-icono usuarios" title={'Ver usuarios de ' + rol.nombre}
                        aria-label={'Ver usuarios de ' + rol.nombre} onClick={() => setDetalleRol(rol)}>
                        <UsersRound size={17} aria-hidden="true" />
                      </button>
                      {apiDisponible && rol.id !== 'ADMINISTRADOR' ? (
                      <button type="button" className="admin-rp-icono" title={'Configurar permisos de ' + rol.nombre}
                        aria-label={'Configurar permisos de ' + rol.nombre} onClick={() => abrirRol(rol)} disabled={guardando}>
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    ) : (
                      <button type="button" className="admin-rp-icono usuarios" title={'Consultar permisos de ' + rol.nombre}
                        aria-label={'Consultar permisos de ' + rol.nombre} onClick={() => setDetalleConsulta({ tipo: 'rol', item: rol })}>
                        <Eye size={16} aria-hidden="true" />
                      </button>
                    )}
                    </div>
                  </article>
                )
              })}
              {!rolesVisibles.length && <p className="admin-rp-sin-resultados">No se encontraron roles.</p>}
            </div>
          </section>
        </section>
      </main>

      {modal && (
        <div className="admin-rp-overlay" onMouseDown={evento => {
          if (evento.currentTarget === evento.target) setModal(null)
        }}>
          <form className="admin-rp-dialog" role="dialog" aria-modal="true"
            aria-labelledby="admin-rp-form-title" onSubmit={guardar}>
            <div className="admin-rp-dialog-heading">
              <h2 id="admin-rp-form-title">Configurar {modal.tipo === 'permiso' ? 'permiso' : 'rol'}</h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Cerrar formulario"><X size={18} /></button>
            </div>
            <p className="admin-rp-dialog-nota">Puedes modificar las operaciones autorizadas para este rol. Las identidades, nombres y descripciones oficiales no se editan desde esta pantalla.</p>
            {errorFormulario && <p className="admin-rp-error" role="alert">{errorFormulario}</p>}
            <p><strong>{formulario.nombre}</strong></p>
            <p className="admin-rp-dialog-nota">{formulario.descripcion}</p>
            <fieldset className="admin-rp-fieldset">
              <legend>{modal.tipo === 'permiso' ? 'Roles con esta operación habilitada' : 'Operaciones permitidas para el rol'}</legend>
              {(modal.tipo === 'permiso' ? roles : permisos).map(item => (
                <label className="admin-rp-checkbox" key={item.id}>
                  <input type="checkbox" checked={formulario.seleccionados.includes(item.id)}
                    disabled={modal.tipo === 'permiso'
                       ? item.id === 'ADMINISTRADOR' || !permisos.find(p => p.id === modal.id)?.rolesPermitidos?.includes(item.id)
                       : modal.id === 'ADMINISTRADOR' || !item.rolesPermitidos?.includes(modal.id)}
                     onChange={() => alternarSeleccion(item.id)} />
                  <span>{modal.tipo === 'permiso' ? etiquetaRol(item.nombre) : etiquetaCodigo(item.nombre)}</span>
                </label>
              ))}
              {(modal.tipo === 'permiso' ? roles : permisos).length === 0 && (
                <p className="admin-rp-muted">No hay elementos disponibles para asociar.</p>
              )}
            </fieldset>
            {modal.tipo === 'rol' && (
              <button type="button" className="admin-rp-secondary"
                onClick={() => setFormulario(actual => ({
                  ...actual,
                  seleccionados: permisos.filter(permiso => permiso.rolesPermitidos.includes(modal.id)).map(permiso => permiso.id),
                }))}>
                Recuperar permisos originales de este rol
              </button>
            )}
            <div className="admin-rp-dialog-actions">
              <button type="button" className="admin-rp-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="admin-rp-primary" disabled={guardando || !apiDisponible}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
            </div>
          </form>
        </div>
      )}

      {confirmacion && (
        <div className="admin-rp-overlay" onMouseDown={evento => {
          if (evento.currentTarget === evento.target) setConfirmacion(null)
        }}>
          <section className="admin-rp-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-rp-confirm-title">
            <div className="admin-rp-dialog-heading">
              <h2 id="admin-rp-confirm-title">¿Eliminar {confirmacion.tipo === 'permiso' ? 'permiso' : 'rol'}?</h2>
              <button type="button" onClick={() => setConfirmacion(null)} aria-label="Cerrar confirmación"><X size={18} /></button>
            </div>
            <p>Se eliminará <strong>{confirmacion.nombre}</strong> de la configuración administrativa.
              Los roles, permisos y accesos reales del sistema permanecerán intactos.</p>
            <div className="admin-rp-dialog-actions">
              <button type="button" className="admin-rp-secondary" onClick={() => setConfirmacion(null)}>Volver</button>
              <button type="button" className="admin-rp-danger" onClick={eliminar} disabled={guardando || !apiDisponible}>{guardando ? 'Eliminando...' : 'Eliminar'}</button>
            </div>
          </section>
        </div>
      )}

      {detalleConsulta && (
        <div className="admin-rp-overlay" onMouseDown={evento => {
          if (evento.currentTarget === evento.target) setDetalleConsulta(null)
        }}>
          <section className="admin-rp-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-rp-consulta-title">
            <div className="admin-rp-dialog-heading">
              <h2 id="admin-rp-consulta-title">{detalleConsulta.item.nombre}</h2>
              <button type="button" aria-label="Cerrar consulta" onClick={() => setDetalleConsulta(null)}><X size={18} /></button>
            </div>
            <p>{detalleConsulta.item.descripcion}</p>
            <p className="admin-rp-dialog-nota">{detalleConsulta.tipo === 'permiso'
              ? 'Roles que tienen esta operación habilitada:'
              : 'Operaciones de escritura habilitadas para este rol:'}</p>
            <ul className="admin-rp-users-list">
              {(detalleConsulta.tipo === 'permiso'
                ? detalleConsulta.item.roles.map(id => roles.find(rol => rol.id === id)?.nombre || id)
                : permisos.filter(permiso => permiso.roles.includes(detalleConsulta.item.id)).map(permiso => permiso.nombre)
              ).map(item => <li key={item}>{etiquetaCodigo(item)}</li>)}
            </ul>
            <div className="admin-rp-dialog-actions">
              <button type="button" className="admin-rp-secondary" onClick={() => setDetalleConsulta(null)}>Cerrar</button>
            </div>
          </section>
        </div>
      )}

      {detalleRol && (
        <div className="admin-rp-overlay" onMouseDown={evento => {
          if (evento.currentTarget === evento.target) setDetalleRol(null)
        }}>
          <section className="admin-rp-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-rp-users-title">
            <div className="admin-rp-dialog-heading">
              <h2 id="admin-rp-users-title">Usuarios · {detalleRol.nombre}</h2>
              <button type="button" onClick={() => setDetalleRol(null)} aria-label="Cerrar usuarios"><X size={18} /></button>
            </div>
            {!usuariosCargados ? <p>Los usuarios no están disponibles en este momento.</p>
              : usuariosDelRol.length ? (
                <ul className="admin-rp-users-list">
                  {usuariosDelRol.map(usuario => (
                    <li key={usuario.usuarioId}>
                      <strong>{usuario.nombre}</strong>
                      <span>{usuario.email}</span>
                    </li>
                  ))}
                </ul>
              ) : <p>No hay usuarios registrados con este rol.</p>}
            <div className="admin-rp-dialog-actions">
              <button type="button" className="admin-rp-secondary" onClick={() => setDetalleRol(null)}>Cerrar</button>
              <button type="button" className="admin-rp-primary"
                onClick={() => navigate('/usuarios')}>Ir a usuarios</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
