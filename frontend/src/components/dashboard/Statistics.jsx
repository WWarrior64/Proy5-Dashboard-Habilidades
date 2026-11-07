import DashboardCard from './DashboardCard.jsx'

export default function Statistics({ stats = [] }) {
  return (
    <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
      {stats.map((stat, idx) => (
        <DashboardCard key={idx} title={stat.title} value={stat.value} subtitle={stat.subtitle} icon={stat.icon} />
      ))}
    </div>
  )
}