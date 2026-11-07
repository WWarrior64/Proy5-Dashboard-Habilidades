export default function EmptyState({ message = 'No hay datos disponibles', icon = '📭' }) {
  return (
    <div className="empty-state">
      <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</span>
      <p>{message}</p>
    </div>
  )
}