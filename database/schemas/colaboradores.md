# Esquema: Colaboradores

Gestión de talento humano. Almacena los perfiles profesionales de los empleados y desarrolladores registrados.

## Nombre de tabla
`im_colaboradores`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| colaboradorId | Sí | String (UUID) | Identificador UUID del colaborador. |
| usuarioId | Sí | String (UUID) | Identificador de la cuenta de usuario relacionada. |
| nombre | Sí | String | Nombre del colaborador. |
| apellido | Sí | String | Apellido del colaborador. |
| correo | Sí | String | Correo de contacto del perfil. |
| cargoId | Sí | String (UUID) | Identificador del cargo profesional registrado en Cargos. |
| rolProfesional | Sí | String | Función o especialidad profesional, ejemplo: DESARROLLADOR, DISEÑADOR, ANALISTA. |
| departamento | No | String | Área o departamento al que pertenece. |
| descripcionPerfil | No | String | Resumen de experiencia y perfil profesional. |
| disponibilidad | Sí | String | DISPONIBLE, PARCIAL o NO_DISPONIBLE. |
| estado | Sí | String | ACTIVO o INACTIVO. |
| fechaIngreso | Sí | String (ISO 8601) | Fecha de ingreso a la organización. |
| fechaCreacion | Sí | String (ISO 8601) | Fecha de creación del perfil. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |
| creadoPor | Sí | String | Usuario que registró el perfil. |

## Claves e índices

- **Clave primaria:** `colaboradorId` (String, simple).
- **GSI1:** Partición: `usuarioId`. Permite encontrar el perfil asociado a una cuenta.
- **GSI2:** Partición: `estado`, Ordenación: `rolProfesional#nombre`. Permite listar colaboradores por estado y rol profesional.

## Patrones de consulta

1. `GET /colaboradores/{colaboradorId}` → Query por clave primaria `colaboradorId`.
2. `GET /colaboradores?usuarioId=X` → Query GSI1 con `usuarioId = :id`.
3. `GET /colaboradores?estado=ACTIVO&rolProfesional=DESARROLLADOR` → Query GSI2 con `estado = 'ACTIVO'` y ordenación `rolProfesional#nombre`.

## Reglas de negocio

- Un usuario no debe tener más de un perfil de colaborador.
- La baja será lógica, cambiando el estado a `INACTIVO`.
- El `cargoId` debe corresponder a un cargo existente y activo en la tabla Cargos.
- `rolProfesional` describe la especialidad y no sustituye al rol de acceso de Usuarios.