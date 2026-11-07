import { Search } from 'lucide-react'

export default function SearchBar({ placeholder = 'Buscar...', value, onChange }) {
  return (
    <div className="relative">
      <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.5rem', color: '#94a3b8' }} />
      <input
        type="text"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="input pl-9"
        style={{
          paddingLeft: '2.25rem',
        }}
      />
    </div>
  )
}