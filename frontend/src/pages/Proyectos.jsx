import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { proyectosService, proyectoEditable } from '../services/proyectos.service.js'
import { usuariosService } from '../services/usuarios.service.js'
import { habilidadesService } from '../services/habilidades.service.js'
import { extractItems } from '../utils/apiResponses.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import Modal from '../components/common/Modal.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import Button from '../components/common/Button.jsx'
import Loading from '../components/common/Loading.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import ProyectoForm from '../components/proyectos/ProyectoForm.jsx'
import ProyectoTable from '../components/proyectos/ProyectoTable.jsx'
import ProyectoFilters from '../components/proyectos/ProyectoFilters.jsx'
import ProyectoDetails from '../components/proyectos/ProyectoDetails.jsx'
import RrhhProyectosVista from './RrhhProyectosVista.jsx'

export default function Proyectos() {
  const { user } = useAuth()
  const [proyectos, setProyectos] = useState([])
  const [lideres, setLideres] = useState([])
  const [habilidadesCatalogo, setHabilidadesCatalogo] = useState([])
  const [requisitosEnEdicion, setRequisitosEnEdicion] = useState([])
  const [borradorPendienteId, setBorradorPendienteId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingProyecto, setEditingProyecto] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [detailProyecto, setDetailProyecto] = useState(null)
  const [filterParams, setFilterParams] = useState({})

  const loadProyectos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await proyectosService.list(filterParams)
      const data = response.data
      let items = []
      if (Array.isArray(data)) {
        items = data
      } else if (data && data.datos && Array.isArray(data.datos)) {
        items = data.datos
      }
      setProyectos(items)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al cargar proyectos'))
    } finally {
      setLoading(false)
    }
  }, [filterParams])

  const loadReferenceData = useCallback(async () => {
    try {
      const usuariosResp = await usuariosService.listAll()
      const uData = usuariosResp.data
      let uItems = []
      if (uData && uData.datos && uData.datos.items) uItems = uData.datos.items
      else if (Array.isArray(uData)) uItems = uData
      else if (uData && uData.datos && Array.isArray(uData.datos)) uItems = uData.datos
      setLideres(uItems.filter((u) => u.rol === 'LIDER_PROYECTO'))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al cargar líderes'))
    }
  }, [])

  useEffect(() => {
    loadProyectos()
  }, [loadProyectos])

  useEffect(() => {
    loadReferenceData()
  }, [loadReferenceData])

  const handleCreate = () => {
    setRequisitosEnEdicion([])
    setBorradorPendienteId(null)
    setEditMode(false)
    setEditingProyecto(null)
    setShowForm(true)
  }

  const handleEdit = async proyecto => {
    if (!proyectoEditable(proyecto)) return
    try {
      const respuesta = await proyectosService.listRequirements(proyecto.proyectoId)
      setRequisitosEnEdicion(extractItems(respuesta.data))
      setEditMode(true)
      setEditingProyecto(proyecto)
      setShowForm(true)
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudieron cargar las habilidades requeridas del proyecto.'))
    }
  }

  const handleViewDetails = (proyecto) => {
    setDetailProyecto(proyecto)
    setShowDetails(true)
  }

  useEffect(() => {
    let activo = true
    habilidadesService.listAll().then(respuesta => {
      if (activo) setHabilidadesCatalogo(extractItems(respuesta.data))
    }).catch(fallo => {
      if (activo) setError(getApiErrorMessage(fallo, 'No se pudo consultar el catálogo de habilidades.'))
    })
    return () => { activo = false }
  }, [])

  const handleSave = async (formData) => {
    setLoading(true)
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        liderId: formData.liderId,
        horasRequeridas: Number(formData.horasRequeridas),
        estado: formData.estado,
      }
      const requisitos = formData.requisitos || []
      if (payload.estado === 'ACTIVO' && !requisitos.length) {
        throw new Error('Debes seleccionar habilidades requeridas antes de publicar el proyecto.')
      }
      if (requisitos.some(item => !habilidadesCatalogo.some(habilidad =>
        habilidad.habilidadId === item.habilidadId && habilidad.estado === 'ACTIVO'))) {
        throw new Error('Solo se pueden seleccionar habilidades activas del catálogo.')
      }
      await proyectosService.saveWorkflow({
        proyectoId: editMode ? editingProyecto?.proyectoId : null,
        borradorId: editMode ? null : borradorPendienteId,
        datos: { ...payload, creadoPor: user?.usuarioId },
        requisitos,
        onDraftReserved: setBorradorPendienteId,
      })
      setBorradorPendienteId(null)
      setShowForm(false)
      setEditingProyecto(null)
      await loadProyectos()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al guardar proyecto'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (proyecto) => {
    setConfirmTarget(proyecto)
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    if (!confirmTarget || !proyectoEditable(confirmTarget)) return
    try {
      await proyectosService.changeStatus(confirmTarget.proyectoId, { estado: 'CANCELADO' })
      setShowConfirm(false)
      setConfirmTarget(null)
      await loadProyectos()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al cancelar proyecto'))
      setShowConfirm(false)
      setConfirmTarget(null)
    }
  }

  const canManage = user?.rol === 'ADMINISTRADOR' || user?.rol === 'RRHH' || user?.rol === 'LIDER_PROYECTO'

  const activos = proyectos.filter((p) => p.estado === 'ACTIVO').length
  const horasRequeridas = proyectos.reduce((acc, p) => acc + (p.horasRequeridas || 0), 0)
  const porIniciar = proyectos.filter((p) => p.estado === 'BORRADOR').length

  return (
    <>
    {['RRHH', 'ADMINISTRADOR'].includes(user?.rol) ? (
      <RrhhProyectosVista
        proyectos={proyectos}
        lideres={lideres}
        loading={loading}
        error={error}
        canManage={canManage}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDetails={handleViewDetails}
        onRetry={loadProyectos}
      />
    ) : (
    <>
    <div className="page-header">
      <div>
        <h1 className="page-title">Mis proyectos</h1>
        <p className="page-subtitle">Administra los proyectos internos, habilidades requeridas y estados</p>
      </div>
      <Button variant="primary" onClick={handleCreate} disabled={loading || !canManage}>
        + Nuevo proyecto
      </Button>
    </div>

    <div className="stats-row">
      <div className="stat-card">
        <p className="stat-label">Proyectos activos</p>
        <p className="stat-value" style={{ color: '#2563eb' }}>{activos}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Horas requeridas</p>
        <p className="stat-value" style={{ color: '#2563eb' }}>{horasRequeridas}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Por iniciar</p>
        <p className="stat-value" style={{ color: '#f59e0b' }}>{porIniciar}</p>
      </div>
    </div>

    <div className="filter-bar">
      <ProyectoFilters onFilter={setFilterParams} />
    </div>

    {loading ? (
      <Loading />
    ) : error ? (
      <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
        <span style={{ fontSize: '3rem' }}>⚠</span>
        <p>{error}</p>
        <Button variant="outline" onClick={loadProyectos}>Reintentar</Button>
      </div>
    ) : proyectos.length === 0 ? (
      <EmptyState message="No hay proyectos registrados" icon="📋" />
    ) : (
      <div className="card-section">
        <div className="card-section-header">
          <h2 className="card-section-title">Proyectos internos</h2>
        </div>
        <div className="card-section-body">
          <ProyectoTable
            proyectos={proyectos}
            onEdit={handleEdit}
            onViewDetails={handleViewDetails}
            onToggleStatus={handleToggleStatus}
            loading={loading}
          />
        </div>
      </div>
    )}
    </>
    )}

    <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editMode ? 'Editar proyecto' : 'Nuevo proyecto'}>
      {error && <p role="alert" className="error-text">{error}</p>}
      <ProyectoForm
        key={editingProyecto?.proyectoId || 'nuevo'}
        proyecto={editingProyecto}
        onSave={handleSave}
        onCancel={() => setShowForm(false)}
        loading={loading}
        lideres={lideres}
        habilidades={habilidadesCatalogo}
        requisitosIniciales={requisitosEnEdicion}
      />
    </Modal>

    <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} title="Detalle del proyecto">
      <ProyectoDetails proyecto={detailProyecto} />
    </Modal>

    <ConfirmDialog
      isOpen={showConfirm}
      onConfirm={handleConfirm}
      onCancel={() => setShowConfirm(false)}
      title="¿Cancelar proyecto?"
      message="El proyecto quedará cancelado y no ofrecerá reactivación desde esta interfaz."
      confirmLabel="Confirmar"
      cancelLabel="Volver"
      danger
    />
    </>
  )
}