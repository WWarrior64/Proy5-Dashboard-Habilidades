# Esquema: Colaboradores

Gestión de talento humano. Almacena los perfiles profesionales de los empleados y desarrolladores registrados.

## Nombre de tabla
`internal-marketplace-colaboradores-dev`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| colaboradorId | Sí (persistido) | String (UUID) | Se genera automáticamente cuando no se envía en la creación. |
| usuarioId | Sí | String (UUID) | Identificador de la cuenta de usuario relacionada. |
| nombre | Sí | String | En la implementación actual se inicializa a partir de `rolProfesional` cuando no se proporciona. |
| cargoId | Sí | String | Identificador del cargo profesional registrado en Cargos. |
| rolProfesional | Sí | String | Especialidad profesional del colaborador. |
| rolProfesional#nombre | Sí | String | Clave compuesta utilizada por el índice de estado y rol. |
| dedicacionReservada | Sí | Number | Porcentaje reservado mediante transacciones de Asignaciones; inicia en 0. |
| disponibilidad | Sí | String | Indicador inicial `DISPONIBLE`; la búsqueda calcula disponibilidad real como `100 - dedicacionReservada`. |
| estado | Sí | String | ACTIVO o INACTIVO. |
| observaciones | No | String | Notas adicionales opcionales. Si el formulario queda vacío, el frontend omite el atributo en lugar de enviar `null`. |
| fechaAlta | Sí | String (ISO 8601) | Fecha de alta del perfil. |
| fechaBaja | No | String (ISO 8601) o null | Fecha de la baja lógica vigente; se borra al reincorporarse. |
| ultimaFechaBaja | No | String (ISO 8601) | Conserva la baja previa cuando el perfil se reincorpora. |
| fechaReincorporacion | No | String (ISO 8601) | Fecha en que un perfil inactivo vuelve al estado `ACTIVO`. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |

## Claves e índices

- **Clave primaria:** `colaboradorId` (String, simple).
- **GSI1:** Partición: `usuarioId`. Permite encontrar el perfil asociado a una cuenta.
- **GSI2:** Partición: `estado`, Ordenación: `rolProfesional#nombre`. Permite listar colaboradores por estado y rol profesional.

## Patrones de consulta

1. `GET /colaboradores/{colaboradorId}` → GetItem por clave primaria `colaboradorId`.
2. `GET /colaboradores/yo` → Consulta GSI1 por el `usuarioId` de la sesión autenticada.
3. `GET /colaboradores?estado=ACTIVO&rolProfesional=DESARROLLADOR` → En la implementación actual usa Scan con filtros y paginación (`lastKey`); no utiliza GSI2.

## Reglas de negocio

- Un usuario puede tener como máximo un perfil de colaborador. Para las nuevas altas se crea transaccionalmente un ítem de reserva con PK `USUARIO#<usuarioId>` y `propietarioColaboradorId`; las consultas de perfiles excluyen estas reservas.
- Los perfiles históricos sin ítem de reserva requieren reconciliación antes de que la protección transaccional abarque todo el histórico.
- La baja es lógica, cambiando el estado a `INACTIVO`. RRHH puede filtrar perfiles dados de baja y reincorporarlos sin crear otro `colaboradorId` ni perder sus habilidades e historial de asignaciones. La reincorporación requiere que la cuenta de Usuario esté activa.
- El `cargoId` debe corresponder a un cargo existente y activo en la tabla Cargos.
- `rolProfesional` describe la especialidad y no sustituye al rol de acceso de Usuarios.
- Los porcentajes de disponibilidad son derivados de `dedicacionReservada`, no de un selector de estado manual; las asignaciones activas reservan capacidad y su finalización/desvinculación la libera.
- Un perfil ligado a un usuario `LIDER_PROYECTO` es elegible para proyectos ajenos, pero no para los proyectos donde ese mismo `usuarioId` coincide con `liderId`. El filtro administrativo oculta los perfiles dados de baja por defecto y permite consultarlos expresamente.