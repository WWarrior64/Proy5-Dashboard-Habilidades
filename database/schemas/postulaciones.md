# Esquema: Postulaciones

Solicitudes de participación. Registra las solicitudes de los colaboradores que desean participar en proyectos internos.

## Nombre de tabla
`im_postulaciones`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| proyectoId | Sí | String (UUID) | Identificador del proyecto al que se postula. |
| colaboradorId | Sí | String (UUID) | Identificador del colaborador que realiza la postulación. |
| postulacionId | Sí | String (UUID) | Identificador UUID de la postulación. |
| estado | Sí | String | PENDIENTE, ACEPTADA, RECHAZADA o RETIRADA. |
| comentario | No | String | Mensaje del colaborador al postularse. |
| observacionRevision | No | String | Comentario de RR. HH. o del líder al revisar. |
| fechaPostulacion | Sí | String (ISO 8601) | Fecha de envío de la solicitud. |
| fechaRevision | No | String (ISO 8601) | Fecha en que se revisó la solicitud. |
| revisadoPor | No | String | Usuario que tomó la decisión. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |

## Claves e índices

- **Clave primaria compuesta:**
  - Partición: `proyectoId`
  - Ordenación: `postulacionKey` — atributo físico sencillo que guarda el valor compuesto (por ejemplo `POSTULACION#colaboradorId`). Permite consultar por proyecto y colaborador.
- **GSI1:**
  - Partición: `colaboradorId`
  - Ordenación: `colaboradorFechaKey` — atributo físico sencillo que guarda el valor compuesto (por ejemplo `fechaPostulacion#proyectoId`). Permite consultar postulaciones por colaborador.

## Patrones de consulta

1. `GET /proyectos/{proyectoId}/postulaciones` → Query por clave primaria con `proyectoId = :id`.
2. `GET /colaboradores/{colaboradorId}/postulaciones` → Query GSI1 con `colaboradorId = :id`.
3. `GET /postulaciones/{proyectoId}/{colaboradorId}` → Query por clave primaria con `proyectoId` y `postulacionKey`.

## Reglas de negocio

- Un colaborador no puede postularse dos veces al mismo proyecto mientras exista su registro de postulación.
- Solo se puede postular a proyectos activos.
- La aceptación de una postulación debe gestionar la creación de la asignación correspondiente.
- Se conserva el historial de las postulaciones rechazadas, aceptadas o retiradas.