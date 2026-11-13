import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Pencil, Trash2, Plus, Search, UserRound } from 'lucide-react'
import EmpleadoLogoutButton from '../components/layout/EmpleadoLogoutButton.jsx'
import { colaboradoresService } from '../services/colaboradores.service.js'
import { habilidadesService } from '../services/habilidades.service.js'
import { extractItems } from '../utils/apiResponses.js'
import { getApiErrorMessage } from '../utils/apiErrors.js'
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

const modoDemo = import.meta.env.VITE_DEMO_MODE === 'true'
const fechaVisible = valor => valor ? new Date(valor).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '—'

export default function Habilidades() {
  const [skills, setSkills] = useState(modoDemo ? initialSkills : [])
  const [catalogo, setCatalogo] = useState([])
  const [colaboradorId, setColaboradorId] = useState(null)
  const [cargando, setCargando] = useState(!modoDemo)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [headerSearch, setHeaderSearch] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptySkill)

  const cargar = async () => {
    setCargando(true)
    setError('')
    try {
      const perfil = await colaboradoresService.getMe()
      const id = perfil.data?.datos?.colaboradorId
      if (!id) throw new Error('La cuenta no tiene un perfil de colaborador.')
      const [relaciones, habilidades] = await Promise.all([
        colaboradoresService.listSkills(id),
        habilidadesService.listAll(),
      ])
      const itemsCatalogo = extractItems(habilidades.data)
      const porId = new Map(itemsCatalogo.map(item => [item.habilidadId, item]))
      setCatalogo(itemsCatalogo)
      setColaboradorId(id)
      setSkills(extractItems(relaciones.data).map(item => {
        const detalle = porId.get(item.habilidadId)
        const nivel = String(item.nivel || 'JUNIOR').toUpperCase()
        return {
          id: item.habilidadId,
          nombre: detalle?.nombre || item.habilidadId,
          categoria: detalle?.categoria || 'Sin categoría',
          nivel: nivel.charAt(0) + nivel.slice(1).toLowerCase(),
          anios: item.anosExperiencia || 0,
          fecha: fechaVisible(item.fechaUltimoUso),
          observaciones: item.observaciones || '',
        }
      }))
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudieron cargar tus habilidades.'))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (!modoDemo) cargar()
  }, [])

  const filtered = useMemo(() => skills.filter(s =>
    s.nombre.toLowerCase().includes(search.toLowerCase()) &&
    s.nombre.toLowerCase().includes(headerSearch.toLowerCase()) &&
    (!category || s.categoria === category) && (!level || s.nivel === level)
  ), [skills, search, headerSearch, category, level])
  const latest = skills.length ? skills.reduce((a, b) => {
    const parse = value => value === '—' ? '' : value.split('/').reverse().join('-')
    return parse(a.fecha) > parse(b.fecha) ? a : b
  }).fecha : '—'
  const openForm = skill => {
    setEditing(skill ? skill.id : 'new')
    setForm(skill ? { ...skill } : { ...emptySkill, fecha: new Date().toLocaleDateString('es-ES') })
  }
  const saveSkill = async event => {
    event.preventDefault()
    if (!form.nombre.trim() || guardando) return
    setError('')
    setGuardando(true)
    try {
      if (modoDemo) {
        if (editing === 'new') setSkills(previous => [...previous, { ...form, id: Date.now() }])
        else setSkills(previous => previous.map(s => s.id === editing ? { ...form, id: s.id } : s))
      } else {
        const habilidad = catalogo.find(item => item.nombre.toLowerCase() === form.nombre.trim().toLowerCase())
        if (!habilidad) throw new Error('La habilidad debe existir en el catálogo de RRHH.')
        if (editing !== 'new' && habilidad.habilidadId !== editing) {
          throw new Error('Para cambiar de habilidad, retira la anterior y registra la nueva.')
        }
        const datos = {
          nivel: form.nivel.toUpperCase(),
          anosExperiencia: Number(form.anios),
          observaciones: form.observaciones,
        }
        if (editing === 'new') {
          await colaboradoresService.addSkill(colaboradorId, { habilidadId: habilidad.habilidadId, ...datos })
        } else {
          await colaboradoresService.updateSkill(colaboradorId, editing, datos)
        }
        await cargar()
      }
      setEditing(null)
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo guardar la habilidad.'))
    } finally {
      setGuardando(false)
    }
  }

  const eliminarSkill = async skill => {
    if (!window.confirm('¿Eliminar ' + skill.nombre + '?') || guardando) return
    setGuardando(true)
    setError('')
    try {
      if (!modoDemo) await colaboradoresService.removeSkill(colaboradorId, skill.id)
      if (modoDemo) setSkills(actuales => actuales.filter(item => item.id !== skill.id))
      else await cargar()
    } catch (fallo) {
      setError(getApiErrorMessage(fallo, 'No se pudo retirar la habilidad.'))
    } finally {
      setGuardando(false)
    }
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
            <NavLink to="/perfil" className="emp-user-icon" aria-label="Abrir mi perfil" title="Mi perfil"><UserRound size={22} /></NavLink>
          </div>
        </header>
        <div className="emp-content skills-content">
          {cargando && <p role="status">Consultando habilidades...</p>}
          {error && <p role="alert">{error}</p>}
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
                <td><div className="skills-actions"><button title={'Editar ' + skill.nombre} aria-label={'Editar ' + skill.nombre} onClick={() => openForm(skill)}><Pencil size={16} /></button><button title={'Eliminar ' + skill.nombre} aria-label={'Eliminar ' + skill.nombre} onClick={() => eliminarSkill(skill)}><Trash2 size={16} /></button></div></td>
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
          <div className="skills-modal-buttons"><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="skills-add" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button></div>
        </form>
      </div>}
    </div>
  )
}