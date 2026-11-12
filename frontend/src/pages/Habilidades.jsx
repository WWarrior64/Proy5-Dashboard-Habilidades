import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Pencil, Trash2, Plus, Search, UserRound } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import './habilidades-empleado.css'

const initialSkills = [
  { id: 1, nombre: 'React', categoria: 'Frontend', nivel: 'Senior', anios: 7, fecha: '12/10/2026', observaciones: 'Especialista en Hooks y Context API' },
  { id: 2, nombre: 'JavaScript', categoria: 'Frontend', nivel: 'Senior', anios: 6, fecha: '15/10/2026', observaciones: 'Dominio de ES6+ y Vanilla' },
  { id: 3, nombre: 'Node.js', categoria: 'Backend', nivel: 'Senior', anios: 4, fecha: '18/10/2026', observaciones: 'APIs REST y GraphQL' },
  { id: 4, nombre: 'SQL', categoria: 'Bases de datos', nivel: 'Mid', anios: 3, fecha: '20/10/2026', observaciones: 'Consultas complejas' },
  { id: 5, nombre: 'AWS', categoria: 'Cloud', nivel: 'Mid', anios: 2, fecha: '22/10/2026', observaciones: 'EC2 y S3' },
  { id: 6, nombre: 'Python', categoria: 'Backend', nivel: 'Junior', anios: 1, fecha: '24/10/2026', observaciones: 'Básico' },
  { id: 7, nombre: 'Java', categoria: 'Backend', nivel: 'Mid', anios: 4, fecha: '26/10/2026', observaciones: 'Spring Boot' },
  { id: 8, nombre: 'CSS', categoria: 'Frontend', nivel: 'Junior', anios: 2, fecha: '28/10/2026', observaciones: 'Responsive Design' },
]
const emptySkill = { nombre: '', categoria: 'Frontend', nivel: 'Junior', anios: 0, fecha: '', observaciones: '' }
const menu = [
  ['Dashboard', '/dashboards/empleado'],
  ['Mis habilidades', '/habilidades'],
  ['Proyectos disponibles', '/proyectos'],
  ['Mis postulaciones', '/postulaciones'],
  ['Mis asignaciones', '/asignaciones'],
]

export default function Habilidades() {
  const [skills, setSkills] = useState(initialSkills)
  const [search, setSearch] = useState('')
  const [headerSearch, setHeaderSearch] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptySkill)
  const filtered = useMemo(() => skills.filter(s =>
    s.nombre.toLowerCase().includes(search.toLowerCase()) &&
    (!category || s.categoria === category) && (!level || s.nivel === level)
  ), [skills, search, category, level])
  const latest = skills.length ? skills.reduce((a, b) => {
    const parse = value => value.split('/').reverse().join('-')
    return parse(a.fecha) > parse(b.fecha) ? a : b
  }).fecha : '—'
  const openForm = skill => {
    setEditing(skill ? skill.id : 'new')
    setForm(skill ? { ...skill } : { ...emptySkill, fecha: new Date().toLocaleDateString('es-ES') })
  }
  const saveSkill = event => {
    event.preventDefault()
    if (!form.nombre.trim()) return
    if (editing === 'new') setSkills(previous => [...previous, { ...form, id: Date.now() }])
    else setSkills(previous => previous.map(s => s.id === editing ? { ...form, id: s.id } : s))
    setEditing(null)
  }
  return (
    <div className="emp-dashboard emp-skills-page">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-top">
          <div className="emp-sidebar-brand">INTERNAL<br />MARKETPLACE</div>
          <div className="emp-sidebar-divider" />
          <nav className="emp-sidebar-menu">
            {menu.map(([label, to]) => <NavLink key={to} to={to} end className={({ isActive }) => 'emp-sidebar-item' + (isActive ? ' active' : '')}>{label}</NavLink>)}
          </nav>
        </div>
        <div className="emp-sidebar-bottom"><div className="emp-sidebar-user">Empleado</div><EmpleadoLogoutButton /></div>
      </aside>
      <main className="emp-main">
        <header className="emp-header">
          <h1 className="emp-header-title">Mis habilidades</h1>
          <div className="emp-header-right">
            <input className="emp-search" aria-label="Buscar en encabezado" placeholder="Buscar..." value={headerSearch} onChange={e => setHeaderSearch(e.target.value)} />
            <div className="emp-user-icon" aria-label="Perfil"><UserRound size={22} /></div>
          </div>
        </header>
        <div className="emp-content skills-content">
          <div className="skills-heading">
            <h2>Gestión de habilidades</h2>
            <button className="skills-add" onClick={() => openForm(null)}><Plus size={15} /> Agregar habilidad</button>
          </div>
          <div className="skills-metrics">
            <div className="emp-card"><p className="emp-card-label">Habilidades registradas</p><p className="emp-card-value">{skills.length}</p></div>
            <div className="emp-card"><p className="emp-card-label">Nivel Senior</p><p className="emp-card-value">{skills.filter(s => s.nivel === 'Senior').length}</p></div>
            <div className="emp-card"><p className="emp-card-label">Última actualización</p><p className="emp-card-value">{latest}</p></div>
          </div>
          <div className="skills-filters">
            <label className="skills-search"><Search size={15} /><input aria-label="Buscar habilidad" placeholder="Buscar habilidad..." value={search} onChange={e => setSearch(e.target.value)} /></label>
            <div className="skills-selects">
              <select aria-label="Filtrar por categoría" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Categoría</option>
                {['Frontend', 'Backend', 'Cloud', 'Bases de datos'].map(x => <option key={x}>{x}</option>)}
              </select>
              <select aria-label="Filtrar por nivel" value={level} onChange={e => setLevel(e.target.value)}>
                <option value="">Nivel</option>
                {['Junior', 'Mid', 'Senior'].map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
          </div>
          <div className="skills-table-wrap">
            <table className="skills-table">
              <thead><tr><th>Habilidad</th><th>Categoría</th><th>Nivel</th><th>Años de experiencia</th><th>Último uso</th><th>Observaciones</th><th>Acciones</th></tr></thead>
              <tbody>{filtered.map(skill => <tr key={skill.id}>
                <td>{skill.nombre}</td><td>{skill.categoria}</td><td><span className={'skills-level ' + skill.nivel.toLowerCase()}>{skill.nivel}</span></td>
                <td>{skill.anios}</td><td>{skill.fecha}</td><td>{skill.observaciones}</td>
                <td><div className="skills-actions"><button title={'Editar ' + skill.nombre} aria-label={'Editar ' + skill.nombre} onClick={() => openForm(skill)}><Pencil size={16} /></button><button title={'Eliminar ' + skill.nombre} aria-label={'Eliminar ' + skill.nombre} onClick={() => { if (window.confirm('¿Eliminar ' + skill.nombre + '?')) setSkills(prev => prev.filter(s => s.id !== skill.id)) }}><Trash2 size={16} /></button></div></td>
              </tr>)}</tbody>
            </table>
            {!filtered.length && <p className="skills-no-results">No hay habilidades que coincidan con los filtros.</p>}
            <div className="skills-count">Mostrando {filtered.length} de {skills.length} habilidades</div>
          </div>
        </div>
      </main>
      {editing !== null && <div className="skills-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setEditing(null) }}>
        <form className="skills-modal" onSubmit={saveSkill}>
          <h2>{editing === 'new' ? 'Agregar habilidad' : 'Editar habilidad'}</h2>
          <label>Habilidad<input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
          <label>Categoría<select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>{['Frontend', 'Backend', 'Cloud', 'Bases de datos'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Nivel<select value={form.nivel} onChange={e => setForm({ ...form, nivel: e.target.value })}>{['Junior', 'Mid', 'Senior'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Años de experiencia<input type="number" min="0" value={form.anios} onChange={e => setForm({ ...form, anios: Number(e.target.value) })} /></label>
          <label>Último uso (dd/mm/aaaa)<input required value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
          <label>Observaciones<input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} /></label>
          <div className="skills-modal-buttons"><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="skills-add" type="submit">Guardar</button></div>
        </form>
      </div>}
    </div>
  )
}