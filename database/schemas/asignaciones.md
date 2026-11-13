# Esquema: Asignaciones

Vinculación de colaboradores con proyectos. Almacena las asignaciones confirmadas de colaboradores a proyectos, incluyendo porcentaje de dedicación y horas comprometidas.

## Nombre de tabla
`internal-marketplace-asignaciones-dev`

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
| estado | Sí | String | `ACTIVA`, `FINALIZADA` o `DESVINCULADA`; se conservan los registros históricos. |
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

1. `GET /api/v1/asignaciones/{asignacionId}` → GetItem por `asignacionId`.
2. `GET /api/v1/colaboradores/{colaboradorId}/asignaciones` → GSI1 por colaborador; el repositorio conserva y consulta también estados históricos, sujeto a autorización por propietario o roles de gestión.
3. `GET /api/v1/proyectos/{proyectoId}/asignaciones` → GSI2 por proyecto; permite consultar el historial cuando el rol tiene permisos sobre él.
4. `GET /api/v1/asignaciones/activas` → GSI3, solo asignaciones activas; `/api/v1/asignaciones` es su alias.
5. `GET /api/v1/asignaciones/mias` → Consulta personal autenticada sin aceptar un `colaboradorId` del navegador. Devuelve `{ items, tienePerfil }`, incluyendo el historial del usuario, incluso si es un líder colaborando en un proyecto ajeno.

## Reglas de negocio

- El porcentaje de dedicación debe ser mayor que cero y menor o igual a 100.
- La suma de las dedicaciones activas de un colaborador no debe superar el 100 %.
- Las horas asignadas deben ser mayores que cero.
- `horasCompletadas` no puede ser negativo ni superar las horas asignadas.
- Al finalizar la participación, se establece `FINALIZADA`; al desvincular, `DESVINCULADA`. Ambos casos conservan el registro y liberan la dedicación reservada.
- **Control atómico de dedicación:** Al crear o actualizar una asignación, los repositorios usan operaciones condicionales sobre `Colaboradores.dedicacionReservada` para impedir superar el 100 % incluso ante concurrencia.
- **Unicidad y permisos:** un mismo colaborador no se puede vincular dos veces al mismo proyecto, incluso después de una desvinculación histórica. Si `Colaboradores.usuarioId = Proyectos.liderId`, se rechaza la autoasignación. Un líder sí puede participar en proyectos ajenos, pero solo administra asignaciones de los que dirige; la consulta de sus propias participaciones es de solo lectura.
- **Filtros:** las vistas muestran asignaciones activas por defecto; las finalizadas, desvinculadas y el historial completo se consultan mediante selección explícita del estado.