# Esquema: Usuarios

Autenticación y permisos. Almacena las cuentas de acceso al sistema. La autenticación y las contraseñas serán gestionadas por Amazon Cognito; DynamoDB almacenará la información interna del usuario y sus permisos.

## Nombre de tabla
`im_usuarios`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| usuarioId | Sí | String (UUID) | Identificador interno del usuario. |
| cognitoSub | Sí | String | Identificador único de usuario proporcionado por Cognito. |
| correo | Sí | String | Correo normalizado en minúsculas y sin espacios externos. |
| nombreCompleto | Sí | String | Nombre completo que se mostrará en el sistema. |
| rol | Sí | String | Rol de acceso: EMPLEADO, RRHH, LIDER_PROYECTO o ADMINISTRADOR. |
| estado | Sí | String | Estado de la cuenta: ACTIVO o INACTIVO. |
| fechaCreacion | Sí | String (ISO 8601) | Fecha y hora de creación del registro. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha y hora de la última modificación. |
| ultimoAcceso | No | String (ISO 8601) | Fecha y hora del último inicio de sesión conocido. |
| creadoPor | No | String | Identificador del administrador o proceso que creó la cuenta. |

## Claves e índices

- **Clave primaria:** `usuarioId` (String, simple).
- **GSI1:** Partición: `cognitoSub`. Permite localizar la cuenta a partir de la identidad autenticada.
- **GSI2:** Partición: `correo`. Permite búsquedas administrativas por correo.

## Patrones de consulta

1. `GET /usuarios/{usuarioId}` → Query por clave primaria `usuarioId`.
2. `GET /usuarios/me (por Cognito)` → Query GSI1 con `cognitoSub = :sub`.
3. `GET /usuarios?correo=X` → Query GSI2 con `correo = :correo`.

## Reglas de negocio

- El correo se normaliza antes de almacenarse.
- No se guardan contraseñas en DynamoDB (gestionado por Cognito).
- El rol determina los permisos dentro del sistema.
- Una cuenta puede existir sin tener un perfil de colaborador (ej. cuenta administrativa).