# Esquema: Postulaciones

Solicitudes de participación. Registra las solicitudes de los colaboradores que desean participar en proyectos internos.

## Nombre de tabla
`internal-marketplace-postulaciones-dev`

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
3. `GET /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}` → GetItem por `proyectoId` y `postulacionKey`.
4. `PATCH /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}/estado` → Aceptar, rechazar o retirar según el estado y los permisos.

## Reglas de negocio

- Un colaborador no puede postularse dos veces al mismo proyecto mientras exista su registro de postulación.
- Solo se puede postular a proyectos activos.
- La aceptación crea la asignación y reserva la dedicación mediante una transacción atómica; el porcentaje acumulado se comprueba en `Colaboradores.dedicacionReservada`, sin depender de lecturas eventualmente consistentes del GSI.
- Las consultas de postulaciones recorren todas las páginas de DynamoDB.
- Se conserva el historial de las postulaciones rechazadas, aceptadas o retiradas.