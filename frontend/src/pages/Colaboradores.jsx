import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { usuariosService } from '../services/usuarios.service.js'
import { cargosService } from '../services/cargos.service.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
import Modal from '../components/common/Modal.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import Button from '../components/common/Button.jsx'
import SearchBar from '../components/common/SearchBar.jsx'
import Loading from '../components/common/Loading.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import ColaboradorForm from '../components/colaboradores/ColaboradorForm.jsx'
import ColaboradorTable from '../components/colaboradores/ColaboradorTable.jsx'
import ColaboradorFilters from '../components/colaboradores/ColaboradorFilters.jsx'
import ColaboradorDetails from '../components/colaboradores/ColaboradorDetails.jsx'

export default function Colaboradores() {
  const { user } = useAuth()
  const [colaboradores, setColaboradores] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargos, setCargos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingColaborador, setEditingColaborador] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [detailsColaborador, setDetailsColaborador] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [filterParams, setFilterParams] = useState({})

  const loadColaboradores = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await colaboradoresService.list(filterParams)
      const data = response.data
      let items = []
      if (data && data.datos && data.datos.items) {
        items = data.datos.items
      } else if (Array.isArray(data)) {
        items = data
      } else if (data && data.datos && Array.isArray(data.datos)) {
        items = data.datos
      }
      setColaboradores(items)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al cargar colaboradores'))
    } finally {
      setLoading(false)
    }
  }, [filterParams])

  const loadReferenceData = useCallback(async () => {
    // Axios agrega el ID Token a ambas peticiones; fetch() omitía Authorization.
    const [usuariosResult, cargosResult] = await Promise.allSettled([
      usuariosService.list({}),
      cargosService.list({ estado: 'ACTIVO' }),
    ])
    if (usuariosResult.status === 'fulfilled') {
      const data = usuariosResult.value.data?.datos
      setUsuarios(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [])
    } else {
      setError(getApiErrorMessage(usuariosResult.reason, 'No se pudieron cargar los usuarios'))
    }
    if (cargosResult.status === 'fulfilled') {
      const data = cargosResult.value.data?.datos
      setCargos(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [])
    } else {
      setCargos([])
      setError(getApiErrorMessage(cargosResult.reason, 'No se pudieron cargar los cargos'))
    }
  }, [])

  useEffect(() => {
    loadColaboradores()
  }, [loadColaboradores])

  useEffect(() => {
    loadReferenceData()
  }, [loadReferenceData])

  const handleCreate = () => {
    setEditMode(false)
    setEditingColaborador(null)
    setShowForm(true)
  }

  const handleEdit = (colaborador) => {
    setEditMode(true)
    setEditingColaborador(colaborador)
    setShowForm(true)
  }

  const handleSave = async (formData) => {
    setLoading(true)
    try {
      if (editMode && editingColaborador) {
        await colaboradoresService.update(editingColaborador.colaboradorId, {
          cargoId: formData.cargoId, rolProfesional: formData.rolProfesional, observaciones: formData.observaciones,
        })
      } else {
        await colaboradoresService.create(formData)
      }
      setShowForm(false)
      setEditingColaborador(null)
      await loadColaboradores()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al guardar colaborador'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (colaborador) => {
    const nuevoEstado = colaborador.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    setConfirmTarget({ ...colaborador, estado: nuevoEstado })
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    if (!confirmTarget) return
    try {
      await colaboradoresService.changeStatus(confirmTarget.colaboradorId, { activo: confirmTarget.estado === 'ACTIVO' })
      setShowConfirm(false)
      setConfirmTarget(null)
      await loadColaboradores()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al cambiar estado'))
      setShowConfirm(false)
      setConfirmTarget(null)
    }
  }

  const canManage = user?.rol === 'ADMINISTRADOR' || user?.rol === 'RRHH'

  const total = colaboradores.length
  const disponibles = colaboradores.filter((c) => c.disponibilidad === 'DISPONIBLE').length
  const asignados = colaboradores.filter((c) => c.disponibilidad === 'ASIGNADA').length

  return (
    <>
    <div className="page-header">
      <div>
        <h1 className="page-title">Colaboradores</h1>
        <p className="page-subtitle">Administra los perfiles profesionales, cargos y disponibilidad</p>
      </div>
      <Button variant="primary" onClick={handleCreate} disabled={loading || !canManage}>
        + Registrar colaborador
      </Button>
    </div>

    <div className="stats-row">
      <div className="stat-card">
        <p className="stat-label">Total colaboradores</p>
        <p className="stat-value">{total}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Disponibles</p>
        <p className="stat-value" style={{ color: '#10b981' }}>{disponibles}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Asignados</p>
        <p className="stat-value" style={{ color: '#f59e0b' }}>{asignados}</p>
      </div>
    </div>

    <div className="filter-bar">
      <ColaboradorFilters onFilter={setFilterParams} />
    </div>

    {loading ? (
      <Loading />
    ) : error ? (
      <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
        <span style={{ fontSize: '3rem' }}>⚠</span>
        <p>{error}</p>
        <Button variant="outline" onClick={loadColaboradores}>Reintentar</Button>
      </div>
    ) : colaboradores.length === 0 ? (
      <EmptyState message="No hay colaboradores registrados" icon="👥" />
    ) : (
      <div className="card-section">
        <div className="card-section-header">
          <h2 className="card-section-title">Listado de colaboradores</h2>
        </div>
        <div className="card-section-body">
          <ColaboradorTable
            colaboradores={colaboradores}
            onEdit={handleEdit}
            onToggleStatus={handleToggleStatus}
            loading={loading}
          />
        </div>
      </div>
    )}

    <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editMode ? 'Editar colaborador' : 'Registrar colaborador'}>
      <ColaboradorForm
        colaborador={editingColaborador}
        onSave={handleSave}
        onCancel={() => setShowForm(false)}
        loading={loading}
        usuarios={usuarios}
        cargos={cargos}
      />
    </Modal>

    <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} title="Detalle del colaborador">
      <ColaboradorDetails colaborador={detailsColaborador} />
    </Modal>

    <ConfirmDialog
      isOpen={showConfirm}
      onConfirm={handleConfirm}
      onCancel={() => setShowConfirm(false)}
      title="¿Cambiar estado de colaborador?"
      message={`¿Está seguro de que desea ${confirmTarget?.estado === 'ACTIVO' ? 'activar' : 'dar de baja'} a este colaborador?`}
      confirmLabel={confirmTarget?.estado === 'ACTIVO' ? 'Activar' : 'Dar de baja'}
      cancelLabel="Volver"
    />
    </>
  )
}