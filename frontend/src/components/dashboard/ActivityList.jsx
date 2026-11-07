import EmptyState from '../common/EmptyState.jsx'

export default function ActivityList({ activities = [], title = 'Actividad reciente' }) {
  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text)' }}>{title}</h3>
      {!activities || activities.length === 0 ? (
        <EmptyState message="No hay actividad reciente" icon="📭" />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {activities.map((activity, idx) => (
            <li key={idx} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: 0, color: 'var(--color-text)' }}>{activity.tipo || 'Evento'}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>{activity.nombre || ''}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>{activity.fecha || ''}</p>
              </div>
              <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>{activity.estado || 'Activo'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}