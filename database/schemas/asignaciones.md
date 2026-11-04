# Esquema: Asignaciones

Vinculación de colaboradores con proyectos. Almacena las asignaciones confirmadas de colaboradores a proyectos, incluyendo porcentaje de dedicación y horas comprometidas.

## Nombre de tabla
`im_asignaciones`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| asignacionId | Sí | String (UUID) | Identificador UUID de la asignación. |
| colaboradorId | Sí | String (UUID) | Identificador del colaborador asignado. |
| proyectoId | Sí | String (UUID) | Identificador del proyecto correspondiente. |
| postulacionId | No | String (UUID) | Identificador de la postulación que originó la asignación. |
| porcentajeDedicacion | Sí | Number | Porcentaje de tiempo que el colaborador dedicará al proyecto (1-100). |
| horasAsignadas | Sí | Number | Cantidad de horas comprometidas para el proyecto. |
| horasCompletadas | Sí | Number | Cantidad de horas realizadas; inicia en cero. |
| fechaInicio | Sí | String (ISO 8601) | Fecha de inicio de la asignación. |
| fechaFin | No | String (ISO 8601) | Fecha de finalización o desvinculación. |
| estado | Sí | String | ACTIVA, FINALIZADA o DESVINCULADA. |
| fechaAsignacion | Sí | String (ISO 8601) | Fecha en que se creó la asignación. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |
| creadoPor | Sí | String | Usuario que realizó la asignación. |

## Claves e índices

- **Clave primaria:** `asignacionId` (String, simple).
- **GSI1:**
  - Partición: `colaboradorId`
  - Ordenación: `colaboradorFechaKey` — atributo físico sencillo que guarda el valor compuesto (por ejemplo `estado#fechaAsignacion`). Permite consultar las asignaciones de un colaborador.
- **GSI2:**
  - Partición: `proyectoId`
  - Ordenación: `proyectoFechaKey` — atributo físico sencillo que guarda el valor compuesto (por ejemplo `estado#fechaAsignacion`). Permite consultar las asignaciones de un proyecto.
- **GSI3:**
  - Partición: `estado`
  - Ordenación: `estadoFechaKey` — atributo físico sencillo que guarda el valor compuesto (por ejemplo `fechaAsignacion#asignacionId`). Permite consultar las asignaciones activas globalmente.

## Patrones de consulta

1. `GET /asignaciones/{asignacionId}` → Query por clave primaria `asignacionId`.
2. `GET /colaboradores/{colaboradorId}/asignaciones?estado=ACTIVA` → Query GSI1 con `colaboradorId = :id` y `colaboradorFechaKey` comienza con `ACTIVA#`.
3. `GET /proyectos/{proyectoId}/asignaciones?estado=ACTIVA` → Query GSI2 con `proyectoId = :id` y `proyectoFechaKey` comienza con `ACTIVA#`.
4. `GET /asignaciones?estado=ACTIVA` → Query GSI3 con `estado = 'ACTIVA'`.

## Reglas de negocio

- El porcentaje de dedicación debe ser mayor que cero y menor o igual a 100.
- La suma de las dedicaciones activas de un colaborador no debe superar el 100 %.
- Las horas asignadas deben ser mayores que cero.
- `horasCompletadas` no puede ser negativo ni superar las horas asignadas.
- Al desvincular a un colaborador, se cambia el estado a `DESVINCULADA` y se registra la fecha de finalización.
- **Control atómico de dedicación:** Al crear o actualizar una asignación, los repositorios deben usar una operación condicional (TransactWriteItems o UpdateItem con ConditionExpression) que verifique que la suma de `porcentajeDedicacion` de asignaciones `ACTIVA` del colaborador más el nuevo porcentaje no exceda 100.