# Esquema: Usuarios

Autenticación y permisos. Almacena las cuentas de acceso al sistema. Amazon Cognito gestiona las credenciales; DynamoDB conserva el perfil interno, los permisos y el último acceso confirmado.

## Nombre de tabla
`internal-marketplace-usuarios-dev`

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
| ultimoAcceso | No | String (ISO 8601 UTC) | Fecha y hora del último inicio de sesión confirmado, registrada por el backend y no reconstruida de accesos anteriores. |
| creadoPor | No | String | Identificador del administrador o proceso que creó la cuenta. |

## Claves e índices

- **Clave primaria:** `usuarioId` (String, simple).
- **GSI1:** Partición: `cognitoSub`. Permite localizar la cuenta a partir de la identidad autenticada.
- **GSI2:** Partición: `correo`. Permite búsquedas administrativas por correo.

## Patrones de consulta

1. `GET /usuarios/{usuarioId}` → Query por clave primaria `usuarioId`.
2. `GET /api/v1/usuarios/yo` → Resolución de identidad por GSI1 con `cognitoSub = :sub`, sin actualizar `ultimoAcceso`.
3. `GET /usuarios?correo=X` → Query GSI2 con `correo = :correo`.

## Reglas de negocio

- El correo se normaliza antes de almacenarse.
- No se guardan contraseñas en DynamoDB (gestionado por Cognito).
- El rol determina los permisos dentro del sistema.
- Una cuenta puede existir sin tener un perfil de colaborador (ej. cuenta administrativa).
- `POST /api/v1/usuarios/yo/acceso` registra la hora del servidor en `ultimoAcceso` tras un inicio de sesión correcto de una cuenta activa. No recibe `usuarioId` ni fecha del cliente. La simple lectura del perfil o el refresco de página no actualizan este campo.
- La reactivación del perfil Colaboradores después de una baja exige que esta cuenta de usuario siga `ACTIVO`. El rol `LIDER_PROYECTO` puede tener perfil de colaborador y participar en proyectos ajenos, pero no en proyectos que lidera.