import { useEffect, useState } from 'react'
import { NOMBRE_PREDETERMINADO, obtenerNombreOrganizacion } from '../../services/branding.service.js'

export default function BrandName() {
  const [nombre, setNombre] = useState(NOMBRE_PREDETERMINADO)
  useEffect(() => {
    let activo = true
    const actualizar = () => {
      void obtenerNombreOrganizacion().then(resultado => {
        if (activo) setNombre(resultado)
      })
    }
    actualizar()
    window.addEventListener('internal-marketplace-brand-updated', actualizar)
    return () => {
      activo = false
      window.removeEventListener('internal-marketplace-brand-updated', actualizar)
    }
  }, [])
  return nombre
}
