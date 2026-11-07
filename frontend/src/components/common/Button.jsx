import { clsx } from 'clsx'

export default function Button({ children, variant = 'primary', size = 'md', disabled = false, onClick, className, type = 'button', ...props }) {
  const base = 'btn font-medium rounded transition disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    primary: 'btn-primary',
    outline: 'btn-outline',
    danger: 'btn-danger',
  }
  const sizes = {
    sm: 'btn-sm',
    md: '',
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={clsx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}