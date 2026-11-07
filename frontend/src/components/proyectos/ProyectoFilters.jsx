import { useState } from 'react'
import Button from '../common/Button.jsx'

export default function ProyectoFilters({ onFilter }) {
  const [estado, setEstado] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onFilter({ estado: estado || undefined })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
      <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input" style={{ minWidth: '160px' }}>
        <option value="">Todos los estados</option>
        <option value="BORRADOR">Por iniciar</option>
        <option value="ACTIVO">Activo</option>
        <option value="PAUSADO">Pausado</option>
        <option value="COMPLETADO">Completado</option>
        <option value="CANCELADO">Cancelado</option>
      </select>
      <Button type="submit" variant="primary" size="sm">Filtrar</Button>
    </form>
  )
}