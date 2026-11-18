import EmptyState from '../common/EmptyState.jsx'
import { etiquetaCodigo } from '../../utils/formatters.js'

function describirActividad(actividad) {
  if (actividad.tipo === 'asignacion') {
    return ({ ACTIVA: 'Asignación registrada', DESVINCULADA: 'Colaborador desvinculado', FINALIZADA: 'Asignación finalizada' })[actividad.estado] || 'Cambio en asignación'
  }
  if (actividad.tipo === 'proyecto') return 'Proyecto registrado'
  return etiquetaCodigo(actividad.tipo) || 'Actividad del sistema'
}

function mostrarFecha(valor) {
  if (!valor) return 'Fecha no registrada'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return 'Fecha no disponible'
  return fecha.toLocaleString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/El_Salvador' })
}

export default function ActivityList({ activities = [], title = 'Actividad reciente' }) {
  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text)' }}>{title}</h3>
      {!activities || activities.length === 0 ? (
        <EmptyState message="No hay actividad reciente" icon="📭" />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {activities.map(activity => (
            <li key={`${activity.tipo || 'evento'}-${activity.id || activity.nombre || ''}-${activity.fecha || ''}`} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: 0, color: 'var(--color-text)' }}>{describirActividad(activity)}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>{activity.nombre || 'Información del registro no disponible'}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>{mostrarFecha(activity.fecha)}</p>
              </div>
              <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>{etiquetaCodigo(activity.estado) || 'Sin estado'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}