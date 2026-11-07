import DataTable from '../common/DataTable.jsx'
import Button from '../common/Button.jsx'

export default function ProyectoTable({ proyectos = [], onEdit, onViewDetails, onToggleStatus, loading = false }) {
  const columns = [
    { key: 'nombre', label: 'Proyecto' },
    { key: 'habilidades', label: 'Habilidades requeridas' },
    { key: 'horasRequeridas', label: 'Horas' },
    { key: 'estado', label: 'Estado' },
    { key: 'acciones', label: 'Acciones' },
  ]

  const data = proyectos.map((p) => ({
    ...p,
    habilidades: p.habilidades?.join(', ') || '-',
    horasRequeridas: p.horasRequeridas || '-',
    acciones: (
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button variant="outline" size="sm" onClick={() => onViewDetails(p)}>Ver</Button>
        <Button variant="outline" size="sm" onClick={() => onEdit(p)}>Editar</Button>
        <Button variant="outline" size="sm" onClick={() => onToggleStatus(p)} style={{ color: '#ef4444' }}>
          Cancelar
        </Button>
      </div>
    ),
  }))

  const renderCell = (row, key) => {
    if (key === 'estado') {
      const colorMap = {
        ACTIVO: '#10b981',
        BORRADOR: '#f59e0b',
        PAUSADO: '#f59e0b',
        COMPLETADO: '#10b981',
        CANCELADO: '#ef4444',
      }
      const color = colorMap[row.estado] || '#64748b'
      const bgMap = {
        ACTIVO: '#dcfce7',
        BORRADOR: '#fef3c7',
        PAUSADO: '#fef3c7',
        COMPLETADO: '#dcfce7',
        CANCELADO: '#fee2e2',
      }
      return <span className="badge" style={{ background: bgMap[row.estado] || '#e2e8f0', color }}>{row.estado}</span>
    }
    if (key === 'acciones') return row.acciones
    return row[key]
  }

  return (
    <DataTable
      columns={columns.map((c) => (c.key === 'estado' || c.key === 'acciones' ? { ...c, render: renderCell } : c))}
      data={data}
      loading={loading}
      emptyMessage="No hay proyectos registrados"
    />
  )
}