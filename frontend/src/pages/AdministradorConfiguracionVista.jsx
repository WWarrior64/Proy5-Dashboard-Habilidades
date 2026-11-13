import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Eye, Pencil, Plus, UserRound, X } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { administracionService } from '../services/administracion.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import './administrador-configuracion.css'

const menu = [
  ['Dashboard', '/dashboards/administrador'],
  ['Usuarios', '/usuarios'],
  ['Roles y permisos', '/roles-permisos'],
  ['Configuración', '/configuracion'],
  ['Auditoría', '/auditoria'],
]

// Los valores de dedicación, niveles y estados reflejan las validaciones actuales
// del backend. El proyecto aún no tiene endpoints de configuración o catálogos.
const parametrosIniciales = [
  {
    id: 'nombre-organizacion',
    nombre: 'Nombre de la organización',
    descripcion: 'Se muestra en la barra lateral y en el inicio de sesión',
    valor: 'Internal Marketplace',
    tipo: 'texto',
    esReferencia: true,
  },
  {
    id: 'limite-dedicacion',
    nombre: 'Límite de dedicación por colaborador',
    descripcion: 'Suma máxima de dedicación activa permitida en asignaciones',
    valor: '100',
    tipo: 'porcentaje',
    esReferencia: true,
  },
]

const catalogosIniciales = [
  {
    id: 'niveles-habilidad',
    nombre: 'Niveles de habilidad',
    descripcion: 'Valores de dominio disponibles para habilidades y requisitos',
    valores: ['Junior', 'Mid', 'Senior'],
    esReferencia: true,
  },
  {
    id: 'estados-proyecto',
    nombre: 'Estados de proyecto',
    descripcion: 'Etapas del ciclo de vida de un proyecto interno',
    valores: ['Borrador', 'Activo', 'Pausado', 'Completado', 'Cancelado'],
    esReferencia: true,
  },
]

const limpiar = valor => String(valor || '').trim()
const normalizar = valor => limpiar(valor).toLocaleLowerCase('es')

export default function AdministradorConfiguracionVista() {
  const [parametros, setParametros] = useState(parametrosIniciales)
  const [catalogos, setCatalogos] = useState(catalogosIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(null)
  const [formulario, setFormulario] = useState({ nombre: '', descripcion: '', valor: '', tipo: 'texto', valoresTexto: '' })
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [apiDisponible, setApiDisponible] = useState(false)

  useEffect(() => {
    let cancelado = false
    administracionService.getConfiguracion()
      .then(respuesta => {
        if (cancelado) return
        setApiDisponible(true)
        const datos = respuesta.data?.datos
        if (Array.isArray(datos?.parametros) && Array.isArray(datos?.catalogos)) {
          setParametros(datos.parametros)
          setCatalogos(datos.catalogos)
        }
      })
      .catch(error_ => {
        if (!cancelado) {
          setApiDisponible(false)
          setAviso(getApiErrorMessage(error_, 'La API administrativa no está disponible. Despliega el backend antes de editar.'))
        }
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  const parametrosVisibles = useMemo(() => parametros.filter(item =>
    [item.nombre, item.descripcion, item.valor].some(valor => normalizar(valor).includes(normalizar(busqueda))),
  ), [parametros, busqueda])
  const catalogosVisibles = useMemo(() => catalogos.filter(item =>
    [item.nombre, item.descripcion, ...item.valores].some(valor => normalizar(valor).includes(normalizar(busqueda))),
  ), [catalogos, busqueda])

  const abrirParametro = item => {
    setModal({ tipo: 'parametro', id: item?.id || null })
    setFormulario({
      nombre: item?.nombre || '',
      descripcion: item?.descripcion || '',
      valor: item?.valor || '',
      tipo: item?.tipo || 'texto',
      valoresTexto: '',
    })
    setError('')
  }

  const abrirCatalogo = item => {
    setModal({ tipo: 'catalogo', id: item?.id || null })
    setFormulario({
      nombre: item?.nombre || '',
      descripcion: item?.descripcion || '',
      valor: '',
      tipo: 'texto',
      valoresTexto: (item?.valores || []).join('\n'),
    })
    setError('')
  }

  const guardar = async evento => {
    evento.preventDefault()
    if (!modal || guardando || !apiDisponible) return
    const siguiente = { parametros, catalogos }
    if (modal.id && (parametros.find(item => item.id === modal.id)?.esReferencia ||
      catalogos.find(item => item.id === modal.id)?.esReferencia)) {
      setError('Las reglas fundamentales son fijas y no pueden cambiarse desde esta pantalla.')
      return
    }
    const nombre = limpiar(formulario.nombre)
    const descripcion = limpiar(formulario.descripcion)

    if (!nombre || !descripcion) {
      setError('El nombre y la descripción son obligatorios.')
      return
    }

    if (modal.tipo === 'parametro') {
      const valor = limpiar(formulario.valor)
      if (!valor || (formulario.tipo === 'porcentaje' &&
        (!Number.isFinite(Number(valor)) || Number(valor) < 1 || Number(valor) > 100))) {
        setError('Introduce un valor válido; para porcentajes utiliza un número entre 1 y 100.')
        return
      }
      if (parametros.some(item => normalizar(item.nombre) === normalizar(nombre) && item.id !== modal.id)) {
        setError('Ya existe un parámetro con ese nombre.')
        return
      }
      const previo = parametros.find(item => item.id === modal.id)
      const editado = {
        id: modal.id || 'demo_parametro_' + crypto.randomUUID(),
        nombre,
        descripcion,
        valor,
        tipo: formulario.tipo,
        esReferencia: previo?.esReferencia || false,
      }
      siguiente.parametros = modal.id
        ? parametros.map(item => item.id === modal.id ? editado : item)
        : [...parametros, editado]
    } else {
      const valores = formulario.valoresTexto.split(/[\n,]/)
        .map(limpiar).filter(Boolean)
      if (!valores.length) {
        setError('Agrega al menos un valor al catálogo.')
        return
      }
      if (new Set(valores.map(normalizar)).size !== valores.length) {
        setError('Los valores del catálogo no pueden estar repetidos.')
        return
      }
      if (catalogos.some(item => normalizar(item.nombre) === normalizar(nombre) && item.id !== modal.id)) {
        setError('Ya existe un catálogo con ese nombre.')
        return
      }
      const previo = catalogos.find(item => item.id === modal.id)
      const editado = {
        id: modal.id || 'demo_catalogo_' + crypto.randomUUID(),
        nombre,
        descripcion,
        valores,
        esReferencia: previo?.esReferencia || false,
      }
      siguiente.catalogos = modal.id
        ? catalogos.map(item => item.id === modal.id ? editado : item)
        : [...catalogos, editado]
    }

    setGuardando(true)
    setError('')
    try {
      await administracionService.saveConfiguracion(siguiente)
      setParametros(siguiente.parametros)
      setCatalogos(siguiente.catalogos)
      setModal(null)
      setAviso('Configuración descriptiva guardada en el backend. No cambia las reglas técnicas de la plataforma.')
    } catch (error_) {
      setError(getApiErrorMessage(error_, 'No se pudo guardar la configuración.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="emp-dashboard admin-config-page">
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
              <span key={nombre} className="emp-sidebar-item" aria-disabled="true"
                title="Próximamente" style={{ cursor: 'default' }}>{nombre}</span>
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
          <h1 className="emp-header-title">Configuración</h1>
          <div className="emp-header-right">
            <input className="emp-search" type="search" placeholder="Buscar..."
              aria-label="Buscar parámetros y catálogos" value={busqueda}
              onChange={evento => setBusqueda(evento.target.value)} />
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil">
              <UserRound size={22} aria-hidden="true" />
            </NavLink>
          </div>
        </header>

        <section className="emp-content admin-config-content" aria-label="Configuración de la plataforma">
          <p className="admin-config-nota" role="status">
            Los parámetros y catálogos adicionales se guardan en el backend. Los límites,
            niveles y estados oficiales permanecen fijos y no cambian por estas opciones.
          </p>
          {cargando && <p className="admin-config-aviso" role="status">Cargando configuración...</p>}
          {aviso && <p className="admin-config-aviso" role="status">{aviso}</p>}

          <section className="admin-config-seccion" aria-labelledby="admin-config-parametros">
            <div className="admin-config-heading">
              <h2 id="admin-config-parametros">Parámetros generales</h2>
              <button type="button" className="admin-config-primary" onClick={() => abrirParametro(null)} disabled={guardando || cargando || !apiDisponible}>
                <Plus size={15} aria-hidden="true" /> Nuevo parámetro
              </button>
            </div>
            <div className="admin-config-lista">
              {parametrosVisibles.map(item => (
                <article className="admin-config-item" key={item.id}>
                  <div className="admin-config-item-info">
                    <h3>{item.nombre}</h3>
                    <p>{item.descripcion}</p>
                    <span className="admin-config-chip">{item.valor}{item.tipo === 'porcentaje' ? ' %' : ''}</span>
                  </div>
                  <div className="admin-config-acciones">
                    <button type="button" className="admin-config-icono"
                      onClick={() => abrirParametro(item)} disabled={item.esReferencia || guardando || cargando || !apiDisponible}
                      aria-label={'Editar ' + item.nombre}
                      title={'Editar ' + item.nombre}>
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
              {!parametrosVisibles.length && <p className="admin-config-vacio">No hay parámetros que coincidan con la búsqueda.</p>}
            </div>
          </section>

          <section className="admin-config-seccion" aria-labelledby="admin-config-catalogos">
            <div className="admin-config-heading">
              <h2 id="admin-config-catalogos">Catálogos del sistema</h2>
              <button type="button" className="admin-config-primary" onClick={() => abrirCatalogo(null)} disabled={guardando || cargando || !apiDisponible}>
                <Plus size={15} aria-hidden="true" /> Nuevo catálogo
              </button>
            </div>
            <div className="admin-config-lista">
              {catalogosVisibles.map(item => (
                <article className="admin-config-item" key={item.id}>
                  <div className="admin-config-item-info">
                    <div className="admin-config-item-title">
                      <h3>{item.nombre}</h3>
                      <span className="admin-config-count">{item.valores.length} valores</span>
                    </div>
                    <p>{item.descripcion}</p>
                    <div className="admin-config-chips">
                      {item.valores.map((valor, indice) => (
                        <span className="admin-config-chip" key={valor + indice}>{valor}</span>
                      ))}
                    </div>
                  </div>
                  <div className="admin-config-acciones">
                    <button type="button" className="admin-config-icono detalle"
                      onClick={() => setDetalle(item)} aria-label={'Ver catálogo ' + item.nombre}
                      title={'Ver catálogo ' + item.nombre}>
                      <Eye size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="admin-config-icono"
                      onClick={() => abrirCatalogo(item)} disabled={item.esReferencia || guardando || cargando || !apiDisponible}
                      aria-label={'Editar catálogo ' + item.nombre}
                      title={'Editar catálogo ' + item.nombre}>
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
              {!catalogosVisibles.length && <p className="admin-config-vacio">No hay catálogos que coincidan con la búsqueda.</p>}
            </div>
          </section>
        </section>
      </main>

      {modal && (
        <div className="admin-config-overlay" onMouseDown={evento => {
          if (evento.target === evento.currentTarget) setModal(null)
        }}>
          <form className="admin-config-dialog" role="dialog" aria-modal="true"
            aria-labelledby="admin-config-form-title" onSubmit={guardar}>
            <div className="admin-config-dialog-heading">
              <h2 id="admin-config-form-title">
                {modal.id ? 'Editar' : 'Nuevo'} {modal.tipo === 'parametro' ? 'parámetro' : 'catálogo'}
              </h2>
              <button type="button" aria-label="Cerrar formulario" onClick={() => setModal(null)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="admin-config-dialog-nota">Los parámetros adicionales se guardan en DynamoDB; las reglas fundamentales no cambian.</p>
            {error && <p className="admin-config-form-error" role="alert">{error}</p>}
            <label>Nombre
              <input required maxLength={110} value={formulario.nombre}
                onChange={evento => setFormulario(actual => ({ ...actual, nombre: evento.target.value }))} />
            </label>
            <label>Descripción
              <textarea required rows={3} maxLength={350} value={formulario.descripcion}
                onChange={evento => setFormulario(actual => ({ ...actual, descripcion: evento.target.value }))} />
            </label>
            {modal.tipo === 'parametro' ? (
              <>
                <label>Tipo de valor
                  <select value={formulario.tipo}
                    onChange={evento => setFormulario(actual => ({ ...actual, tipo: evento.target.value }))}>
                    <option value="texto">Texto</option>
                    <option value="porcentaje">Porcentaje (%)</option>
                  </select>
                </label>
                <label>Valor
                  <input required type={formulario.tipo === 'porcentaje' ? 'number' : 'text'}
                    min={formulario.tipo === 'porcentaje' ? 1 : undefined}
                    max={formulario.tipo === 'porcentaje' ? 100 : undefined}
                    maxLength={formulario.tipo === 'porcentaje' ? undefined : 180}
                    value={formulario.valor}
                    onChange={evento => setFormulario(actual => ({ ...actual, valor: evento.target.value }))} />
                </label>
              </>
            ) : (
              <label>Valores del catálogo
                <textarea required rows={6} value={formulario.valoresTexto}
                  placeholder="Un valor por línea (o separados por comas)"
                  onChange={evento => setFormulario(actual => ({ ...actual, valoresTexto: evento.target.value }))} />
              </label>
            )}
            <div className="admin-config-dialog-actions">
              <button type="button" className="admin-config-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="admin-config-primary" disabled={guardando || !apiDisponible}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
            </div>
          </form>
        </div>
      )}

      {detalle && (
        <div className="admin-config-overlay" onMouseDown={evento => {
          if (evento.target === evento.currentTarget) setDetalle(null)
        }}>
          <section className="admin-config-dialog" role="dialog" aria-modal="true"
            aria-labelledby="admin-config-detail-title">
            <div className="admin-config-dialog-heading">
              <h2 id="admin-config-detail-title">{detalle.nombre}</h2>
              <button type="button" aria-label="Cerrar detalle" onClick={() => setDetalle(null)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p>{detalle.descripcion}</p>
            <p className="admin-config-dialog-nota">{detalle.valores.length} valores · Vista de referencia</p>
            <ul className="admin-config-detail-list">
              {detalle.valores.map((valor, indice) => <li key={valor + indice}>{valor}</li>)}
            </ul>
            <div className="admin-config-dialog-actions">
              <button type="button" className="admin-config-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
              <button type="button" className="admin-config-primary" onClick={() => {
                setDetalle(null)
                abrirCatalogo(detalle)
              }}>Editar catálogo</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
