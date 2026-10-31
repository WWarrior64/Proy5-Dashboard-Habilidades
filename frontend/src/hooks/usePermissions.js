import { useAuth } from './useAuth.js'
import { hasPermission } from '../utils/permissions.js'

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.rol
  return {
    role,
    hasPermission: (permission) => hasPermission(role, permission),
    canManage: () => {
      switch (role) {
        case 'ADMINISTRADOR':
        case 'RECURSOS_HUMANOS':
        case 'LIDER_PROYECTO':
          return true
        default:
          return false
      }
    },
  }
}