import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usuariosService } from '../../services/usuarios.service.js'
import { proyectosService } from '../../services/proyectos.service.js'
import Statistics from '../../components/dashboard/Statistics.jsx'
import ActivityList from '../../components/dashboard/ActivityList.jsx'
import QuickActions from '../../components/dashboard/QuickActions.jsx'
import Button from '../../components/common/Button.jsx'
import Loading from '../../components/common/Loading.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { DEMO_USUARIOS, DEMO_ACTIVIDADES } from '../../data/demoData.js'
import { getApiErrorMessage } from '../../utils/apiErrors.js'

export default function AdministradorDashboard() {
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

  const loadDashboardData = useCallback(async () => {
    if (demoMode) return
    setLoading(true)
    setError(null)
    try {
      const [usuariosResp, proyectosResp] = await Promise.allSettled([
        usuariosService.list({}),
        proyectosService.list({}),
      ])

      if (usuariosResp.status === 'rejected') setError(getApiErrorMessage(usuariosResp.reason))
      if (proyectosResp.status === 'rejected') setError(getApiErrorMessage(proyectosResp.reason))

      if (usuariosResp.status === 'fulfilled') {
        const data = usuariosResp.value.data
        let items = []
        if (data && data.datos && data.datos.items) items = data.datos.items
        else if (Array.isArray(data)) items = data
        else if (data && data.datos && Array.isArray(data.datos)) items = data.datos
        setUsuarios(items)
      }

      if (proyectosResp.status === 'fulfilled') {
        const data = proyectosResp.value.data
        let items = []
        if (Array.isArray(data)) items = data
        else if (data && data.datos && Array.isArray(data.datos)) items = data.datos
        setProyectos(items)
      }
    } catch (err) {
      setError(err.message || 'Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [demoMode])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const totalUsuarios = demoMode ? DEMO_USUARIOS.length : usuarios.length
  const activosUsuarios = demoMode ? DEMO_USUARIOS.filter((u) => u.estado === 'ACTIVO').length : usuarios.filter((u) => u.estado === 'ACTIVO').length

  const stats = [
    { title: 'Usuarios', value: totalUsuarios, subtitle: `${activosUsuarios} activos`, icon: '👥' },
    { title: 'Activos', value: activosUsuarios, subtitle: 'Usuarios con acceso', icon: '✓' },
    { title: 'Roles', value: 4, subtitle: 'Empleado, RRHH, Líder, Admin', icon: '🎭' },
    { title: 'Pendientes', value: demoMode ? 0 : proyectos.filter((p) => p.estado === 'BORRADOR').length, subtitle: 'Proyectos por iniciar', icon: '⏳' },
  ]

  const actividades = demoMode ? DEMO_ACTIVIDADES : []

  const quickActions = [
    { label: 'Gestionar usuarios', onClick: () => navigate('/usuarios') },
    { label: 'Gestionar colaboradores', onClick: () => navigate('/colaboradores') },
    { label: 'Gestionar proyectos', onClick: () => navigate('/proyectos') },
  ]

  return (
    <>
    <div className="page-header">
      <div>
        <h1 className="page-title">Resumen</h1>
        <p className="page-subtitle">Panel de control para administradores</p>
      </div>
      {demoMode && (
        <div style={{ background: '#dbeafe', color: '#1e40af', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📋</span> Modo demostración - Datos de ejemplo
        </div>
      )}
    </div>

    {loading ? (
      <Loading />
    ) : error ? (
      <div className="empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
        <span style={{ fontSize: '3rem' }}>⚠</span>
        <p>{error}</p>
        <Button variant="outline" onClick={loadDashboardData}>Reintentar</Button>
      </div>
    ) : (
      <>
        <Statistics stats={stats} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <ActivityList activities={actividades} />

          <div className="card-section">
            <div className="card-section-header">
              <h2 className="card-section-title">Usuarios recientes</h2>
            </div>
            <div className="card-section-body">
              {(demoMode ? DEMO_USUARIOS : usuarios).length > 0 ? (
                <>
                  {(demoMode ? DEMO_USUARIOS : usuarios).slice(0, 3).map((u) => (
                    <div key={u.usuarioId} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: 0, color: 'var(--color-text)' }}>{u.nombre}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>{u.email}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="badge" style={{ background: u.rol === 'ADMINISTRADOR' || u.rol === 'RRHH' ? '#dbeafe' : '#dcfce7', color: u.rol === 'ADMINISTRADOR' || u.rol === 'RRHH' ? '#1e40af' : '#166534' }}>{u.rol}</span>
                        <p style={{ fontSize: '0.75rem', color: u.estado === 'ACTIVO' ? '#166534' : '#991b1b', margin: '0.25rem 0 0' }}>{u.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <EmptyState message="No hay usuarios recientes" icon="👥" />
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
          <QuickActions actions={quickActions} />

          <div className="card-section">
            <div className="card-section-header">
              <h2 className="card-section-title">Acceso rápido</h2>
            </div>
            <div className="card-section-body">
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
                Utilice el menú lateral para navegar a Usuarios, Colaboradores o Proyectos.
              </p>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  )
}