import { useState } from 'react'

export default function RoleSelector({ value, onChange }) {
  const roles = [
    { value: 'EMPLEADO', label: 'Empleado' },
    { value: 'RRHH', label: 'Recursos Humanos' },
    { value: 'LIDER_PROYECTO', label: 'Líder de Proyecto' },
    { value: 'ADMINISTRADOR', label: 'Administrador' },
  ]

  return (
    <div className="form-group">
      <label className="label">Rol</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      >
        <option value="">Seleccionar rol</option>
        {roles.map((rol) => (
          <option key={rol.value} value={rol.value}>{rol.label}</option>
        ))}
      </select>
    </div>
  )
}