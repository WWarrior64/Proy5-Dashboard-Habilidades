import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import Modal from '../common/Modal.jsx'
import { cargosService } from '../../services/cargos.service.js'
import { extractItems } from '../../utils/apiResponses.js'
import { getApiErrorMessage } from '../../utils/apiErrors.js'
import './gestion-cargos.css'

const formularioVacio = { nombre: '', descripcion: '', categoria: 'GENERAL' }

export default function GestionCargosModal({ abierto, onClose, onUpdated }) {
  const [cargos, setCargos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('ACTIVO')
  const [formulario, setFormulario] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const respuesta = await cargosService.list({ limit: 100 })
      setCargos(extractItems(respuesta.data))
      setAviso(respuesta.data?.datos?.lastKey
        ? 'La lista supera los 100 registros. Algunos cargos no se muestran todavía.'
        : '')
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudieron consultar los cargos.'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (abierto) cargar()
    else {
      setFormulario(null)
      setEditandoId(null)
      setConfirmacion(null)
      setError('')
      setAviso('')
    }
  }, [abierto, cargar])

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')
    return cargos.filter(item =>
      (estadoFiltro === 'TODOS' || item.estado === estadoFiltro) &&
      [item.nombre, item.descripcion, item.categoria, item.estado]
        .some(valor => String(valor || '').toLocaleLowerCase('es').includes(termino)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [cargos, busqueda, estadoFiltro])

  const abrirFormulario = cargo => {
    setEditandoId(cargo?.cargoId || null)
    setFormulario(cargo ? {
      nombre: cargo.nombre || '',
      descripcion: cargo.descripcion || '',
      categoria: cargo.categoria || 'GENERAL',
    } : { ...formularioVacio })
    setError('')
  }

  const guardar = async evento => {
    evento.preventDefault()
    if (guardando || cargando || !formulario) return
    const payload = {
      nombre: formulario.nombre.trim(),
      descripcion: formulario.descripcion.trim(),
      categoria: formulario.categoria.trim().toUpperCase() || 'GENERAL',
    }
    if (!payload.nombre) {
      setError('El nombre del cargo es obligatorio.')
      return
    }
    if (cargos.some(item => item.cargoId !== editandoId &&
      item.nombre.trim().toLocaleLowerCase('es') === payload.nombre.toLocaleLowerCase('es'))) {
      setError('Ya existe un cargo con ese nombre.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      if (editandoId) await cargosService.update(editandoId, payload)
      else await cargosService.create(payload)
      setFormulario(null)
      setEditandoId(null)
      await cargar()
      onUpdated?.()
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo guardar el cargo.'))
    } finally {
      setGuardando(false)
    }
  }

  const cambiarEstado = cargo => {
    if (guardando || cargando) return
    setError('')
    setConfirmacion(cargo)
  }

  const confirmarCambioEstado = async () => {
    if (!confirmacion || guardando || cargando) return
    const activar = confirmacion.estado !== 'ACTIVO'
    setGuardando(true)
    setError('')
    try {
      await cargosService.changeStatus(confirmacion.cargoId, { activo: activar })
      setConfirmacion(null)
      await cargar()
      onUpdated?.()
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo cambiar el estado del cargo.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen={abierto} onClose={() => { if (!guardando) onClose() }} title="Gestionar cargos" className="gestion-cargos-dialog">
      <section className="gestion-cargos-contenido" aria-label="Administración de cargos de Recursos Humanos">
        <p className="page-subtitle">Registra y actualiza los cargos que RRHH asigna a los colaboradores.</p>
        {error && <p role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        {aviso && <p role="status">{aviso}</p>}

        {confirmacion ? (
          <div className="gestion-cargos-confirmacion" role="group" aria-labelledby="cargo-confirmar-titulo">
            <h3 id="cargo-confirmar-titulo">Confirmar cambio de estado</h3>
            <p>¿Deseas {confirmacion.estado === 'ACTIVO' ? 'desactivar' : 'activar'} el cargo <strong>{confirmacion.nombre}</strong>?</p>
            <p className="gestion-cargos-descripcion">La modificación se aplicará al catálogo utilizado por Recursos Humanos.</p>
            <div className="gestion-cargos-confirmacion-acciones">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmacion(null)} disabled={guardando}>Volver</button>
              <button type="button" className="btn btn-primary" onClick={confirmarCambioEstado} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        ) : formulario ? (
          <form onSubmit={guardar} style={{ display: 'grid', gap: '0.75rem' }}>
            <label className="label" htmlFor="cargo-nombre">Nombre del cargo</label>
            <input id="cargo-nombre" className="input" maxLength={100} required
              value={formulario.nombre}
              onChange={e => setFormulario(actual => ({ ...actual, nombre: e.target.value }))} />
            <label className="label" htmlFor="cargo-categoria">Categoría</label>
            <input id="cargo-categoria" className="input" maxLength={50} required
              value={formulario.categoria}
              onChange={e => setFormulario(actual => ({ ...actual, categoria: e.target.value }))} />
            <label className="label" htmlFor="cargo-descripcion">Descripción</label>
            <textarea id="cargo-descripcion" className="input" rows={3} maxLength={500}
              value={formulario.descripcion}
              onChange={e => setFormulario(actual => ({ ...actual, descripcion: e.target.value }))} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setFormulario(null)}
                disabled={guardando}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Registrar cargo'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="gestion-cargos-barra">
              <label className="gestion-cargos-busqueda">
                <Search size={16} aria-hidden="true" />
                <input className="input" type="search" aria-label="Buscar cargos"
                  placeholder="Buscar cargos..." value={busqueda}
                  onChange={e => setBusqueda(e.target.value)} />
              </label>
              <select className="input" aria-label="Filtrar cargos por estado" value={estadoFiltro}
                  onChange={evento => setEstadoFiltro(evento.target.value)}>
                  <option value="ACTIVO">Estado: Activos</option>
                  <option value="INACTIVO">Desactivados</option>
                  <option value="TODOS">Todos los estados</option>
                </select>
                <button type="button" className="btn btn-primary" onClick={() => abrirFormulario(null)}
                disabled={cargando || guardando}>
                <Plus size={16} aria-hidden="true" /> Nuevo cargo
              </button>
            </div>
            {cargando ? <p role="status">Consultando cargos...</p> : (
              <div className="gestion-cargos-listado">
                <table className="table gestion-cargos-tabla">
                  <thead><tr><th>Cargo</th><th>Categoría</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {visibles.map(cargo => (
                      <tr key={cargo.cargoId}>
                        <td data-label="Cargo"><strong>{cargo.nombre}</strong><div className="gestion-cargos-descripcion">{cargo.descripcion || 'Sin descripción'}</div></td>
                        <td data-label="Categoría">{cargo.categoria || 'GENERAL'}</td>
                        <td data-label="Estado">{cargo.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</td>
                        <td data-label="Acciones">
                          <div className="gestion-cargos-acciones">
                            <button type="button" className="btn btn-outline"
                              aria-label={'Editar cargo ' + cargo.nombre}
                              onClick={() => abrirFormulario(cargo)} disabled={guardando}>
                              <Pencil size={15} aria-hidden="true" /> Editar
                            </button>
                            <button type="button" className="btn btn-outline" disabled={guardando}
                              onClick={() => cambiarEstado(cargo)}>
                              {cargo.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibles.length && !error && <p>No hay cargos que coincidan con la búsqueda.</p>}
              </div>
            )}
          </>
        )}
      </section>
    </Modal>
  )
}
