import { useState } from 'react'
import DataTable from '../common/DataTable.jsx'
import Button from '../common/Button.jsx'

export default function UsuarioTable({ usuarios = [], onEdit, onToggleStatus, loading = false }) {
  const columns = [
    { key: 'nombre', label: 'Usuario' },
    { key: 'email', label: 'Correo' },
    { key: 'rol', label: 'Rol' },
    { key: 'estado', label: 'Estado' },
    { key: 'acciones', label: 'Acciones' },
  ]

  const data = usuarios.map((u) => ({
    ...u,
    acciones: (
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button variant="outline" size="sm" onClick={() => onEdit(u)}>Editar</Button>
        <Button variant="outline" size="sm" onClick={() => onToggleStatus(u)} style={{ color: u.estado === 'ACTIVO' ? '#ef4444' : '#10b981' }}>
          {u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
        </Button>
      </div>
    ),
  }))

  const renderCell = (row, key) => {
    if (key === 'estado') {
      const color = row.estado === 'ACTIVO' ? '#10b981' : '#ef4444'
      return <span className="badge" style={{ background: color === '#10b981' ? '#dcfce7' : '#fee2e2', color }}>{row.estado}</span>
    }
    if (key === 'acciones') return row.acciones
    return row[key]
  }

  return (
    <DataTable
      columns={columns.map((c) => (c.key === 'estado' || c.key === 'acciones' ? { ...c, render: renderCell } : c))}
      data={data}
      loading={loading}
      emptyMessage="No hay usuarios registrados"
    />
  )
}