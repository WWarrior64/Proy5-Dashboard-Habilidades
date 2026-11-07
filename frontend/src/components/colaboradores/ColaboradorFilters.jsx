import { useState } from 'react'
import Button from '../common/Button.jsx'

export default function ColaboradorFilters({ onFilter }) {
  const [estado, setEstado] = useState('')
  const [rol, setRol] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onFilter({ estado: estado || undefined, rolProfesional: rol || undefined })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
      <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input" style={{ minWidth: '140px' }}>
        <option value="">Todos los estados</option>
        <option value="ACTIVO">Activo</option>
        <option value="INACTIVO">Inactivo</option>
      </select>
      <select value={rol} onChange={(e) => setRol(e.target.value)} className="input" style={{ minWidth: '180px' }}>
        <option value="">Todos los roles</option>
        <option value="Junior">Junior</option>
        <option value="Mid">Mid</option>
        <option value="Senior">Senior</option>
      </select>
      <Button type="submit" variant="primary" size="sm">Filtrar</Button>
    </form>
  )
}