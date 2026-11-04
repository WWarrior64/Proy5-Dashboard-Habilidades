# Esquema: Proyectos

Gestión de proyectos internos. Almacena los requerimientos de los proyectos que necesitan personal técnico.

## Nombre de tabla
`im_proyectos`

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
| fechaPublicacion | No | String (ISO 8601) | Fecha en que el proyecto se hizo visible para los empleados. |
| fechaCreacion | Sí | String (ISO 8601) | Fecha de creación. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |
| creadoPor | Sí | String | Usuario que registró el proyecto. |

## Claves e índices

- **Clave primaria:** `proyectoId` (String, simple).
- **GSI1:** Partición: `estado`, Ordenación: `fechaPublicacion#proyectoId`. Permite consultar proyectos activos.
- **GSI2:** Partición: `liderId`, Ordenación: `estado#fechaCreacion`. Permite consultar los proyectos de un líder según su estado.

## Patrones de consulta

1. `GET /proyectos/{proyectoId}` → Query por clave primaria `proyectoId`.
2. `GET /proyectos?estado=ACTIVO` → Query GSI1 con `estado = 'ACTIVO'`.
3. `GET /proyectos?liderId=X&estado=ACTIVO` → Query GSI2 con `liderId = :id` y `estado = 'ACTIVO'`.

## Reglas de negocio

- El líder debe ser un usuario válido con rol LIDER_PROYECTO.
- Las horas requeridas representan el total de horas que necesita el proyecto.
- Los proyectos cancelados se conservan en la base de datos.
- Las habilidades requeridas se almacenan en ProyectoHabilidad, no como una lista sin estructura.