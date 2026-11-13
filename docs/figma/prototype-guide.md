# Guía del Prototipo (Figma)

**Universidad Católica de El Salvador – Cómputo en la Nube – Grupo B**

## Enlaces
- Prototipo de referencia: confirmar con el equipo el enlace público/permiso de acceso vigente antes de la entrega; este documento no incluye un enlace verificado.

## Flujos de usuario
1. Login → Dashboard según rol.
2. Colaboradores → CRUD completo con filtros por rol y nivel de habilidad.
3. Proyectos → Registro, consulta de activos, modificación de horas, cancelación.
4. Asignaciones → Vinculación colaborador-proyecto con % de dedicación; separación entre asignaciones de proyectos dirigidos y participaciones personales del líder en proyectos ajenos.
5. Postulaciones → Lista, tarjetas y acciones de respuesta.

## Alineación frontend
Los componentes de React en `frontend/src/pages/` y `frontend/src/components/` implementan las pantallas del sistema. La implementación funcional prevalece sobre capturas antiguas del prototipo y debe contrastarse visualmente antes de la entrega.

## Reglas de interacción actualizadas

- RRHH puede dar de baja y reincorporar perfiles, consultar cargos desactivados y filtrar registros inactivos en sus vistas. Las observaciones de colaboradores y habilidades son opcionales.
- El formulario de proyectos requiere seleccionar al menos una habilidad antes de publicar. Se muestra la fecha de publicación y el fin estimado en función de las horas, señalando que es una estimación.
- La asignación de un colaborador a su propio proyecto cuando también es el líder se bloquea. Un líder sí puede participar en proyectos de otros responsables; sus asignaciones personales aparecen en una sección separada y de solo lectura.
- Administración muestra `ultimoAcceso` y consulta una bitácora persistente de auditoría con filtros por fecha, usuario, entidad y acción, una vez desplegada la versión correspondiente.