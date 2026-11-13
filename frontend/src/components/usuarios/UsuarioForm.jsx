import { useState } from 'react'
import Button from '../common/Button.jsx'
import RoleSelector from './RoleSelector.jsx'

export default function UsuarioForm({ usuario, onSave, onCancel, loading = false, mode = 'create' }) {
  const [form, setForm] = useState({
    nombre: usuario?.nombre || '',
    email: usuario?.email || '',
    rol: usuario?.rol || '',
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const newErrors = {}
    if (!form.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio'
    if (!form.email.trim()) newErrors.email = 'El correo es obligatorio'
    if (!form.rol) newErrors.rol = 'El rol es obligatorio'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSave({ nombre: form.nombre.trim(), email: form.email.trim().toLowerCase(), rol: form.rol })
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="form-group">
        <label className="label">Nombre <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <input
          type="text"
          className={`input ${errors.nombre ? 'input-error' : ''}`}
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        {errors.nombre && <p className="error-text">{errors.nombre}</p>}
      </div>
      <div className="form-group">
        <label className="label">Correo <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <input
          type="email"
          disabled={Boolean(usuario)}
          className={`input ${errors.email ? 'input-error' : ''}`}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {errors.email && <p className="error-text">{errors.email}</p>}
      </div>
      <div className="form-group">
        <RoleSelector value={form.rol} onChange={(v) => setForm({ ...form, rol: v })} />
        {errors.rol && <p className="error-text">{errors.rol}</p>}
      </div>
      {mode === 'create' && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
          El sistema buscará la cuenta por correo electrónico en Cognito. Si no existe,
          creará la cuenta y enviará una invitación con contraseña temporal.
        </p>
      )}
      <div className="modal-footer" style={{ justifyContent: 'flex-end', borderTop: 'none', paddingTop: 0 }}>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {mode === 'create' ? 'Añadir' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}