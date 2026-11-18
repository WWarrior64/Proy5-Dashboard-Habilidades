import { CircleAlert, Info } from 'lucide-react'
import Button from './Button.jsx'

export default function ConfirmDialog({ isOpen, onConfirm, onCancel, title = '¿Confirmar esta acción?', message = 'Esta acción no se puede deshacer.', confirmLabel = 'Confirmar', cancelLabel = 'Volver', danger = false, loading = false }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal" style={{ maxWidth: '420px' }}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {danger
              ? <CircleAlert size={22} strokeWidth={2} color="#dc2626" aria-hidden="true" style={{ flexShrink: 0 }} />
              : <Info size={22} strokeWidth={2} color="#2563eb" aria-hidden="true" style={{ flexShrink: 0 }} />}
            <h2 id="confirm-title" className="modal-title" style={{ margin: 0 }}>{title}</h2>
          </div>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{message}</p>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <Button variant="outline" size="md" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="md" onClick={onConfirm} disabled={loading}>{loading ? 'Procesando...' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}