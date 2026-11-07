export default function ColaboradorDetails({ colaborador }) {
  if (!colaborador) return null

  return (
    <div className="card">
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text)' }}>Detalle del Colaborador</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Nombre</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{colaborador.nombre || colaborador.colaboradorId}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Usuario</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{colaborador.usuarioId || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Cargo</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{colaborador.cargoId || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Rol Profesional</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{colaborador.rolProfesional || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Estado</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{colaborador.estado || 'ACTIVO'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Disponibilidad</p>
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{colaborador.disponibilidad || 'DISPONIBLE'}</p>
        </div>
      </div>
      {colaborador.observaciones && (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>Observaciones</p>
          <p style={{ fontSize: '0.95rem', margin: '0.25rem 0 0', color: 'var(--color-text)' }}>{colaborador.observaciones}</p>
        </div>
      )}
    </div>
  )
}