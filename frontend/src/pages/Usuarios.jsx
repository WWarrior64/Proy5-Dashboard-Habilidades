import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { usuariosService } from '../services/usuarios.service.js'
import Modal from '../components/common/Modal.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import Button from '../components/common/Button.jsx'
import SearchBar from '../components/common/SearchBar.jsx'
import Loading from '../components/common/Loading.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import UsuarioForm from '../components/usuarios/UsuarioForm.jsx'
import UsuarioTable from '../components/usuarios/UsuarioTable.jsx'
import { ROLES } from '../utils/constants.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'

const ESTADOS = ['ACTIVO', 'INACTIVO']

export default function Usuarios() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [rolFilter, setRolFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingUsuario, setEditingUsuario] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)

  const loadUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (rolFilter) params.rol = rolFilter
      if (estadoFilter) params.estado = estadoFilter
      const response = await usuariosService.list(params)
      const data = response.data
      let items = []
      if (data && data.datos && data.datos.items) {
        items = data.datos.items
      } else if (Array.isArray(data)) {
        items = data
      } else if (data && data.datos && Array.isArray(data.datos)) {
        items = data.datos
      }
      setUsuarios(items)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al cargar usuarios'))
    } finally {
      setLoading(false)
    }
  }, [rolFilter, estadoFilter])

  useEffect(() => {
    loadUsuarios()
  }, [loadUsuarios])

  const filteredUsuarios = usuarios.filter((u) => {
    const matchesSearch = u.nombre?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const matchesRol = !rolFilter || u.rol === rolFilter
    const matchesEstado = !estadoFilter || u.estado === estadoFilter
    return matchesSearch && matchesRol && matchesEstado
  })

  const handleCreate = () => {
    setEditMode(false)
    setEditingUsuario(null)
    setShowForm(true)
  }

  const handleEdit = (usuario) => {
    setEditMode(true)
    setEditingUsuario(usuario)
    setShowForm(true)
  }

  const handleSave = async (formData) => {
    setLoading(true)
    try {
      if (editMode && editingUsuario) {
        const changes = {}
        if (formData.nombre !== editingUsuario.nombre) changes.nombre = formData.nombre
        if (formData.email !== editingUsuario.email) changes.email = formData.email
        if (Object.keys(changes).length) await usuariosService.update(editingUsuario.usuarioId, changes)
        if (formData.rol !== editingUsuario.rol) {
          await usuariosService.changeRole(editingUsuario.usuarioId, { rol: formData.rol })
        }
      } else {
        await usuariosService.create(formData)
      }
      setShowForm(false)
      setEditingUsuario(null)
      await loadUsuarios()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al guardar usuario'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (usuario) => {
    const nuevoEstado = usuario.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    setConfirmTarget({ ...usuario, estado: nuevoEstado })
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    if (!confirmTarget) return
    try {
      await usuariosService.changeStatus(confirmTarget.usuarioId, { activo: confirmTarget.estado === 'ACTIVO' })
      setShowConfirm(false)
      setConfirmTarget(null)
      await loadUsuarios()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al cambiar estado'))
      setShowConfirm(false)
      setConfirmTarget(null)
    }
  }

  const canManageUsuarios = user?.rol === 'ADMINISTRADOR' || user?.rol === 'RRHH'

  const total = usuarios.length
  const activos = usuarios.filter((u) => u.estado === 'ACTIVO').length
  const inactivos = usuarios.filter((u) => u.estado === 'INACTIVO').length

  return (
    <>
    <div className="page-header">
      <div>
        <h1 className="page-title">Usuarios</h1>
        <p className="page-subtitle">Administra las cuentas de acceso, sus roles y su estado</p>
      </div>
      <Button variant="primary" onClick={handleCreate} disabled={loading || !canManageUsuarios}>
        + Crear usuario
      </Button>
    </div>

    <div className="stats-row">
      <div className="stat-card">
        <p className="stat-label">Total</p>
        <p className="stat-value">{total}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Activos</p>
        <p className="stat-value" style={{ color: '#10b981' }}>{activos}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Inactivos</p>
        <p className="stat-value" style={{ color: '#ef4444' }}>{inactivos}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Roles</p>
        <p className="stat-value">4</p>
      </div>
    </div>

    <div className="filter-bar">
      <SearchBar placeholder="Buscar por nombre o correo" value={search} onChange={setSearch} />
      <select value={rolFilter} onChange={(e) => setRolFilter(e.target.value)} className="input" style={{ minWidth: '140px' }}>
        <option value="">Todos los roles</option>
        {Object.values(ROLES).map((rol) => (
          <option key={rol} value={rol}>{rol}</option>
        ))}
      </select>
      <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="input" style={{ minWidth: '140px' }}>
        <option value="">Todos los estados</option>
        {ESTADOS.map((est) => (
          <option key={est} value={est}>{est}</option>
        ))}
      </select>
    </div>

    {loading ? (
      <Loading />
    ) : error ? (
      <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
        <span style={{ fontSize: '3rem' }}>⚠</span>
        <p>{error}</p>
        <Button variant="outline" onClick={loadUsuarios}>Reintentar</Button>
      </div>
    ) : filteredUsuarios.length === 0 ? (
      <EmptyState message="No se encontraron usuarios" icon="👥" />
    ) : (
      <div className="card-section">
        <div className="card-section-header">
          <h2 className="card-section-title">Usuarios recientes</h2>

        </div>
        <div className="card-section-body">
          <UsuarioTable
            usuarios={filteredUsuarios}
            onEdit={handleEdit}
            onToggleStatus={handleToggleStatus}
            loading={loading}
          />
        </div>
      </div>
    )}

    <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editMode ? 'Editar usuario' : 'Crear usuario'}>
      <UsuarioForm
        usuario={editingUsuario}
        onSave={handleSave}
        onCancel={() => setShowForm(false)}
        loading={loading}
        mode={editMode ? 'edit' : 'create'}
      />
    </Modal>

    <ConfirmDialog
      isOpen={showConfirm}
      onConfirm={handleConfirm}
      onCancel={() => setShowConfirm(false)}
      title="¿Cambiar estado de usuario?"
      message={`¿Está seguro de que desea ${confirmTarget?.estado === 'ACTIVO' ? 'activar' : 'desactivar'} a este usuario?`}
      confirmLabel={confirmTarget?.estado === 'ACTIVO' ? 'Activar' : 'Desactivar'}
      cancelLabel="Volver"
    />
    </>
  )
}