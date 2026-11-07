export default function ProyectoDetails({ proyecto }) {
  if (!proyecto) return null

  const estadoLabels = {
    BORRADOR: 'Por iniciar',
    ACTIVO: 'Activo',
    PAUSADO: 'Pausado',
    COMPLETADO: 'Completado',
    CANCELADO: 'Cancelado',
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text)' }}>Detalle del Proyecto</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Nombre</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{proyecto.nombre}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Descripción</p>
          <p style={{ fontSize: '0.95rem', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{proyecto.descripcion || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Líder</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{proyecto.liderId || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Horas Requeridas</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{proyecto.horasRequeridas || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Estado</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{estadoLabels[proyecto.estado] || proyecto.estado}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Habilidades</p>
          <p style={{ fontSize: '0.95rem', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{proyecto.habilidades?.join(', ') || '-'}</p>
        </div>
      </div>
    </div>
  )
}