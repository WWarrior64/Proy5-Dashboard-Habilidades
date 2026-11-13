import DataTable from '../common/DataTable.jsx'
import Button from '../common/Button.jsx'
import { disponibilidadCalculada, porcentajeLibre } from '../../utils/disponibilidad.js'

export default function ColaboradorTable({ colaboradores = [], onEdit, onToggleStatus, loading = false }) {
  const columns = [
    { key: 'nombre', label: 'Colaborador' },
    { key: 'rolProfesional', label: 'Rol' },
    { key: 'habilidades', label: 'Habilidades' },
    { key: 'nivel', label: 'Nivel' },
    { key: 'disponibilidad', label: 'Disponibilidad' },
    { key: 'acciones', label: 'Acciones' },
  ]

  const data = colaboradores.map((c) => ({
    ...c,
    nombre: c.nombre || `${c.usuarioId || ''} ${c.colaboradorId || ''}`,
    habilidades: c.habilidades?.join(', ') || 'Sin habilidades',
    nivel: c.nivel || '-',
    disponibilidad: disponibilidadCalculada(c),
    porcentajeLibre: porcentajeLibre(c),
    acciones: (
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button variant="outline" size="sm" onClick={() => onEdit(c)}>Editar</Button>
        <Button variant="outline" size="sm" onClick={() => onToggleStatus(c)} style={{ color: '#ef4444' }}>
          Baja
        </Button>
      </div>
    ),
  }))

  const renderCell = (row, key) => {
    if (key === 'disponibilidad') {
      const color = row.disponibilidad === 'DISPONIBLE' ? '#10b981' : '#f59e0b'
      return <span className="badge" style={{ background: color === '#10b981' ? '#dcfce7' : '#fef3c7', color }}>
        {row.disponibilidad}{row.porcentajeLibre == null ? '' : ` · ${row.porcentajeLibre} % libre`}
      </span>
    }
    if (key === 'acciones') return row.acciones
    return row[key]
  }

  return (
    <DataTable
      columns={columns.map((c) => (c.key === 'disponibilidad' || c.key === 'acciones' ? { ...c, render: renderCell } : c))}
      data={data}
      loading={loading}
      emptyMessage="No hay colaboradores registrados"
    />
  )
}