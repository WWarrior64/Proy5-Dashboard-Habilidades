import Button from '../common/Button.jsx'

export default function QuickActions({ actions = [] }) {
  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text)' }}>Acciones rápidas</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {actions.map((action, idx) => (
          <Button key={idx} variant="outline" size="md" onClick={action.onClick} style={{ flex: 1, minWidth: '140px', justifyContent: 'center' }}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}