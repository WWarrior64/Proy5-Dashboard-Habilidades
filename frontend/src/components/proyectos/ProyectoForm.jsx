import { useState } from 'react'
import Button from '../common/Button.jsx'

export default function ProyectoForm({ proyecto, onSave, onCancel, loading = false, lideres = [] }) {
  const [form, setForm] = useState({
    nombre: proyecto?.nombre || '',
    descripcion: proyecto?.descripcion || '',
    liderId: proyecto?.liderId || '',
    horasRequeridas: proyecto?.horasRequeridas || '',
    estado: proyecto?.estado || 'BORRADOR',
    creadoPor: proyecto?.creadoPor || '',
  })
  const [errors, setErrors] = useState({})

  const estados = [
    { value: 'BORRADOR', label: 'Por iniciar (Borrador)' },
    { value: 'ACTIVO', label: 'Activo' },
    { value: 'PAUSADO', label: 'Pausado' },
    { value: 'COMPLETADO', label: 'Completado' },
    { value: 'CANCELADO', label: 'Cancelado' },
  ]

  const validate = () => {
    const newErrors = {}
    if (!form.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio'
    if (!form.descripcion.trim()) newErrors.descripcion = 'La descripción es obligatoria'
    if (!form.liderId.trim()) newErrors.liderId = 'El líder es obligatorio'
    if (!form.horasRequeridas || parseFloat(form.horasRequeridas) <= 0) newErrors.horasRequeridas = 'Las horas deben ser positivas'
    if (!form.estado) newErrors.estado = 'El estado es obligatorio'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="form-group">
        <label className="label">Nombre del Proyecto <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <input
          type="text"
          className={`input ${errors.nombre ? 'input-error' : ''}`}
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        {errors.nombre && <p className="error-text">{errors.nombre}</p>}
      </div>
      <div className="form-group">
        <label className="label">Descripción <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <textarea
          className={`input ${errors.descripcion ? 'input-error' : ''}`}
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          rows={3}
        />
        {errors.descripcion && <p className="error-text">{errors.descripcion}</p>}
      </div>
      <div className="form-group">
        <label className="label">Líder de Proyecto <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <select
          className={`input ${errors.liderId ? 'input-error' : ''}`}
          value={form.liderId}
          onChange={(e) => setForm({ ...form, liderId: e.target.value })}
        >
          <option value="">Seleccionar líder</option>
          {lideres.map((l) => (
            <option key={l.usuarioId || l.id} value={l.usuarioId || l.id}>
              {l.nombre || l.email || l.usuarioId || l.id}
            </option>
          ))}
        </select>
        {errors.liderId && <p className="error-text">{errors.liderId}</p>}
      </div>
      <div className="form-group">
        <label className="label">Horas Requeridas <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <input
          type="number"
          className={`input ${errors.horasRequeridas ? 'input-error' : ''}`}
          value={form.horasRequeridas}
          onChange={(e) => setForm({ ...form, horasRequeridas: e.target.value })}
        />
        {errors.horasRequeridas && <p className="error-text">{errors.horasRequeridas}</p>}
      </div>
      <div className="form-group">
        <label className="label">Estado</label>
        <select
          className="input"
          value={form.estado}
          onChange={(e) => setForm({ ...form, estado: e.target.value })}
        >
          {estados.map((est) => (
            <option key={est.value} value={est.value}>{est.label}</option>
          ))}
        </select>
      </div>
      <div className="modal-footer" style={{ justifyContent: 'flex-end', borderTop: 'none', paddingTop: 0 }}>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={loading}>
          Guardar
        </Button>
      </div>
    </form>
  )
}