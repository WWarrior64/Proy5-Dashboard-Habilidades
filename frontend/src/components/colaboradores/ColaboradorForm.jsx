import { useState } from 'react'
import Button from '../common/Button.jsx'
import { ROLES } from '../../utils/constants.js'

export default function ColaboradorForm({ colaborador, onSave, onCancel, loading = false, usuarios = [], cargos = [] }) {
  const [form, setForm] = useState({
    usuarioId: colaborador?.usuarioId || '',
    cargoId: colaborador?.cargoId || '',
    rolProfesional: colaborador?.rolProfesional || '',
    observaciones: colaborador?.observaciones || '',
  })
  const [errors, setErrors] = useState({})
  const editing = Boolean(colaborador)
  const usuariosSeleccionables = editing ? usuarios : usuarios.filter(u =>
    ![ROLES.RRHH, ROLES.ADMINISTRADOR].includes(String(u.rol || '').trim().toUpperCase()))

  const validate = () => {
    const newErrors = {}
    if (!editing && !form.usuarioId.trim()) newErrors.usuarioId = 'El usuario es obligatorio'
    if (!form.cargoId.trim()) newErrors.cargoId = 'El cargo es obligatorio'
    if (!form.rolProfesional.trim()) newErrors.rolProfesional = 'El rol profesional es obligatorio'
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
      {!editing && <p className="page-subtitle">El identificador se genera automáticamente. Cada cuenta puede tener un único perfil de colaborador, incluso si se encuentra inactivo.</p>}
      <div className="form-group">
        <label className="label">Usuario <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <select
          disabled={editing}
          className={`input ${errors.usuarioId ? 'input-error' : ''}`}
          value={form.usuarioId}
          onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}
        >
          <option value="">Seleccionar usuario</option>
          {usuariosSeleccionables.map((u) => (
            <option key={u.usuarioId || u.id} value={u.usuarioId || u.id}>
              {u.nombre || u.email || u.usuarioId || u.id}
            </option>
          ))}
        </select>
        {errors.usuarioId && <p className="error-text">{errors.usuarioId}</p>}
      </div>
      <div className="form-group">
        <label className="label">Cargo <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <select
          className={`input ${errors.cargoId ? 'input-error' : ''}`}
          value={form.cargoId}
          onChange={(e) => setForm({ ...form, cargoId: e.target.value })}
        >
          <option value="">Seleccionar cargo</option>
          {cargos.map((c) => (
            <option key={c.cargoId || c.id} value={c.cargoId || c.id}>
              {c.nombre || c.cargoId || c.id}
            </option>
          ))}
        </select>
        {errors.cargoId && <p className="error-text">{errors.cargoId}</p>}
      </div>
      <div className="form-group">
        <label className="label">Rol Profesional <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <input
          type="text"
          className={`input ${errors.rolProfesional ? 'input-error' : ''}`}
          value={form.rolProfesional}
          onChange={(e) => setForm({ ...form, rolProfesional: e.target.value })}
        />
        {errors.rolProfesional && <p className="error-text">{errors.rolProfesional}</p>}
      </div>
      <div className="form-group">
        <label className="label">Observaciones (opcional)</label>
        <textarea
          className="input"
          value={form.observaciones}
          onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
          rows={3}
        />
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