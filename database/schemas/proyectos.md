# Esquema: Proyectos

Gestión de proyectos internos. Almacena los requerimientos de los proyectos que necesitan personal técnico.

## Nombre de tabla
`internal-marketplace-proyectos-dev`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| proyectoId | Sí | String (UUID) | Identificador UUID del proyecto. |
| nombre | Sí | String | Nombre del proyecto. |
| descripcion | Sí | String | Descripción general del requerimiento. |
| objetivo | No | String | Resultado que se espera conseguir. |
| liderId | Sí | String (UUID) | Identificador del usuario responsable del proyecto. |
| horasRequeridas | Sí | Number | Total de horas que necesita el proyecto. |
| fechaInicio | No | String (ISO 8601) | Fecha prevista de inicio. |
| fechaFin | No | String (ISO 8601) | Fecha prevista de finalización. |
| estado | Sí | String | BORRADOR, ACTIVO, PAUSADO, COMPLETADO o CANCELADO. |
| asignacionesActivas | Sí para registros nuevos | Number | Contador de asignaciones en estado ACTIVA, actualizado mediante transacciones; los históricos requieren reconciliación. |
| requisitosRevision | Sí para registros nuevos | Number | Revisión de requisitos utilizada para prevenir eliminaciones simultáneas de la última habilidad. |
| fechaPublicacion | No | String (ISO 8601) | Primera activación del proyecto desde `BORRADOR`, registrada por el backend; los borradores nuevos carecen de ella. |
| fechaCreacion | Sí | String (ISO 8601) | Fecha de creación. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |
| creadoPor | Sí | String | Usuario que registró el proyecto. |

## Claves e índices

- **Clave primaria:** `proyectoId` (String, simple).
- **GSI1:** Partición `estado`, ordenación física `fechaPublicacionKey` (`fechaPublicacion#proyectoId`).
- **GSI2:** Partición `liderId`, ordenación física `estadoFechaKey` (`estado#fechaCreacion` inicialmente).

## Patrones de consulta

1. `GET /proyectos/{proyectoId}` → GetItem por `proyectoId`.
2. `GET /proyectos?estado=ACTIVO` → Query GSI1 por estado con lectura paginada.
3. `GET /proyectos?liderId=X&estado=ACTIVO` → Query GSI2 por líder con filtro adicional de estado; la API exige `estado` o `liderId`.

## Reglas de negocio

- El líder debe ser un usuario válido con rol `LIDER_PROYECTO`.
- Los proyectos nuevos se guardan primero como `BORRADOR` y no pueden crearse directamente como `ACTIVO`. Antes de publicar deben tener al menos una habilidad requerida en ProyectoHabilidad. Al activarse se fija la primera `fechaPublicacion` y no se sustituye durante ediciones posteriores.
- Las horas requeridas representan el total de horas que necesita el proyecto. Si no hay `fechaInicio`/`fechaFin` planificadas, el frontend muestra como inicio la fecha de publicación y estima el fin usando 8 horas por jornada de lunes a viernes, sin descontar festivos. Ese fin **es una estimación visual**, no un campo `fechaFin` automáticamente persistido.
- Los proyectos cancelados y completados se conservan en la base de datos; las vistas de gestión muestran los proyectos vigentes por defecto, permitiendo revelar los históricos mediante filtros.
- Transiciones válidas: `BORRADOR → ACTIVO/CANCELADO`, `ACTIVO → PAUSADO/COMPLETADO/CANCELADO` y `PAUSADO → ACTIVO/COMPLETADO/CANCELADO`. Los estados `COMPLETADO` y `CANCELADO` son terminales. Para cerrarlos se requiere `asignacionesActivas = 0`.
- Los cambios de estado y de requisitos comprueban condiciones concurrentes mediante DynamoDB. Las nuevas relaciones y asignaciones deben respetar el estado vigente del proyecto.
- Las habilidades requeridas se almacenan en ProyectoHabilidad, no como una lista sin estructura.
- El mismo usuario no puede liderar y participar como colaborador en un proyecto que dirige; sí puede participar en proyectos liderados por otras personas.