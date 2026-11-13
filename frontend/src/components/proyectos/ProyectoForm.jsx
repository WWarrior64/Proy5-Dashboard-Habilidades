import { useState } from 'react'
import Button from '../common/Button.jsx'

export default function ProyectoForm({ proyecto, onSave, onCancel, loading = false,
  lideres = [], habilidades = [], requisitosIniciales = [] }) {
  const [form, setForm] = useState({
    nombre: proyecto?.nombre || '',
    descripcion: proyecto?.descripcion || '',
    liderId: proyecto?.liderId || '',
    horasRequeridas: proyecto?.horasRequeridas || '',
    estado: proyecto?.estado || 'BORRADOR',
    creadoPor: proyecto?.creadoPor || '',
    requisitos: requisitosIniciales.map(item => ({
      habilidadId: item.habilidadId, nivelMinimo: item.nivelMinimo || 'JUNIOR',
    })),
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
    if (form.estado === 'ACTIVO' && form.requisitos.length === 0) {
      newErrors.requisitos = 'Selecciona al menos una habilidad antes de publicar el proyecto'
    }
    if (form.requisitos.some(item => !habilidades.some(habilidad =>
      habilidad.habilidadId === item.habilidadId && habilidad.estado === 'ACTIVO'))) {
      newErrors.requisitos = 'Selecciona únicamente habilidades activas del catálogo de RRHH'
    }
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
      <div className="form-group">
        <label className="label">Habilidades requeridas</label>
        <p className="page-subtitle">Selecciona las habilidades y el nivel mínimo para este proyecto.</p>
        {form.requisitos.map((requisito, indice) => (
          <div key={requisito.habilidadId} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <select className="input" aria-label={'Habilidad requerida ' + (indice + 1)}
              style={{ flex: '2 1 160px', minWidth: 0 }} value={requisito.habilidadId} disabled={loading}
              onChange={e => setForm(actual => ({
                ...actual, requisitos: actual.requisitos.map((item, posicion) =>
                  posicion === indice ? { ...item, habilidadId: e.target.value } : item),
              }))}>
              {habilidades.filter(item => item.estado === 'ACTIVO' &&
                (item.habilidadId === requisito.habilidadId ||
                  !form.requisitos.some(actual => actual.habilidadId === item.habilidadId)))
                .map(item => <option key={item.habilidadId} value={item.habilidadId}>{item.nombre}</option>)}
            </select>
            <select className="input" aria-label={'Nivel mínimo ' + (indice + 1)}
              style={{ flex: '1 1 110px', minWidth: 0 }} value={requisito.nivelMinimo} disabled={loading}
              onChange={e => setForm(actual => ({
                ...actual, requisitos: actual.requisitos.map((item, posicion) =>
                  posicion === indice ? { ...item, nivelMinimo: e.target.value } : item),
              }))}>
              <option value="JUNIOR">Junior</option>
              <option value="MID">Mid</option>
              <option value="SENIOR">Senior</option>
            </select>
            <button type="button" className="btn btn-outline" aria-label={'Quitar habilidad ' + (indice + 1)}
              disabled={loading}
              onClick={() => setForm(actual => ({
                ...actual, requisitos: actual.requisitos.filter((_, posicion) => posicion !== indice),
              }))}>Quitar</button>
          </div>
        ))}
        <button type="button" className="btn btn-outline" disabled={loading ||
          !habilidades.some(item => item.estado === 'ACTIVO' &&
            !form.requisitos.some(actual => actual.habilidadId === item.habilidadId))}
          onClick={() => {
            const siguiente = habilidades.find(item => item.estado === 'ACTIVO' &&
              !form.requisitos.some(actual => actual.habilidadId === item.habilidadId))
            if (siguiente) setForm(actual => ({
              ...actual, requisitos: [...actual.requisitos, {
                habilidadId: siguiente.habilidadId, nivelMinimo: 'JUNIOR',
              }],
            }))
          }}>+ Añadir habilidad</button>
        {errors.requisitos && <p className="error-text">{errors.requisitos}</p>}
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