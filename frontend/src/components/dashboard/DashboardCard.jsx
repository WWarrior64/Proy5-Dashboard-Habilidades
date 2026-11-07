export default function DashboardCard({ title, value, subtitle, icon }) {
  return (
    <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <p className="stat-label" style={{ marginBottom: '0.25rem' }}>{title}</p>
        <p className="stat-value">{value}</p>
        {subtitle && <p className="stat-label" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{subtitle}</p>}
      </div>
      {icon && <span style={{ fontSize: '2rem', opacity: 0.2 }}>{icon}</span>}
    </div>
  )
}