export default function Loading({ message = 'Cargando...' }) {
  return (
    <div className="loading-container">
      <div className="spinner" />
      <p style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)' }}>{message}</p>
    </div>
  )
}