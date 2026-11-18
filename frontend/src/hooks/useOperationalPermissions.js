import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.js'
import { usuariosService } from '../services/usuarios.service.js'

// Permisos de los roles ya existentes. Mantener operativas las vistas si
// /usuarios/yo/permisos aún no está desplegado o falla temporalmente.
const PERMISOS_BASE = Object.freeze({
  EMPLEADO: ['gestionar_habilidades_propias', 'gestionar_postulaciones'],
  RRHH: ['gestionar_colaboradores', 'gestionar_cargos', 'gestionar_habilidades',
    'gestionar_habilidades_propias', 'gestionar_proyectos', 'gestionar_asignaciones',
    'gestionar_postulaciones'],
  LIDER_PROYECTO: ['gestionar_habilidades_propias', 'gestionar_proyectos',
    'gestionar_asignaciones', 'gestionar_postulaciones'],
  ADMINISTRADOR: ['gestionar_usuarios', 'gestionar_colaboradores', 'gestionar_cargos',
    'gestionar_habilidades', 'gestionar_habilidades_propias', 'gestionar_proyectos',
    'gestionar_asignaciones', 'gestionar_postulaciones'],
})
const permisosPorRol = rol => PERMISOS_BASE[rol] || []
const MODO_DEMO = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'

// Varias vistas usan este hook a la vez. Compartir la consulta evita repetir
// preflights fallidos para una ruta que aún no está publicada en API Gateway.
// Una respuesta válida se conserva brevemente; un error solo difiere los reintentos.
const consultas = new Map()
const MAX_EXITO_MS = 30_000
const MAX_ERROR_MS = 10 * 60_000
const modoPruebas = import.meta.env.MODE === 'test'

async function obtenerPermisosCompartidos(usuarioId, rol, forzar = false) {
  const clave = `${usuarioId}:${rol}`
  const existente = consultas.get(clave)
  const ahora = Date.now()
  if (!modoPruebas && !forzar && existente &&
      (existente.pendiente || existente.hasta > ahora)) {
    return existente.pendiente || existente.operaciones
  }
  const estado = { pendiente: null, operaciones: null, hasta: 0 }
  if (!modoPruebas) consultas.set(clave, estado)
  const pendiente = usuariosService.getMyPermissions()
    .then(respuesta => {
      const operaciones = respuesta.data?.datos?.operaciones
      if (!Array.isArray(operaciones)) throw new Error('La respuesta de permisos no incluye operaciones')
      estado.operaciones = operaciones.filter(item => permisosPorRol(rol).includes(item))
      estado.hasta = Date.now() + MAX_EXITO_MS
      return estado.operaciones
    })
    .catch(() => {
      estado.operaciones = null
      estado.hasta = Date.now() + MAX_ERROR_MS
      return null
    })
    .finally(() => { estado.pendiente = null })
  estado.pendiente = pendiente
  return pendiente
}

export function useOperationalPermissions() {
  const { user } = useAuth()
  const [operaciones, setOperaciones] = useState(() => permisosPorRol(user?.rol))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let activo = true
    const actualizar = async (evento) => {
      if (!user) {
        if (activo) { setOperaciones([]); setLoading(false) }
        return
      }
      // El rol del usuario ya establece sus capacidades originales; si el perfil
      // aún no tiene ID o se ejecuta el demo, no se hace una consulta que bloquee la UI.
      if (!user.usuarioId || MODO_DEMO) {
        if (activo) { setOperaciones(permisosPorRol(user.rol)); setLoading(false) }
        return
      }
      if (activo) setLoading(true)
      const autorizadas = await obtenerPermisosCompartidos(user.usuarioId, user.rol,
        evento?.type === 'internal-marketplace-permissions-updated')
      // Ante un fallo de API no se restringen los permisos históricos en la UI.
      // Cada operación sigue comprobándose en el backend.
      if (activo) {
        if (Array.isArray(autorizadas)) setOperaciones(autorizadas)
        setLoading(false)
      }
    }
    setOperaciones(permisosPorRol(user?.rol))
    void actualizar()
    window.addEventListener('focus', actualizar)
    window.addEventListener('internal-marketplace-permissions-updated', actualizar)
    return () => {
      activo = false
      window.removeEventListener('focus', actualizar)
      window.removeEventListener('internal-marketplace-permissions-updated', actualizar)
    }
  }, [user?.usuarioId, user?.rol])

  const canOperate = useCallback(
    id => permisosPorRol(user?.rol).includes(id) && operaciones.includes(id),
    [operaciones, user?.rol],
  )
  return { operaciones, canOperate, loading }
}
