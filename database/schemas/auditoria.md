# Esquema: Auditoría

Registro de eventos de cambios confirmados e inicios de sesión de Internal Marketplace, creado y consultado desde Lambda. El usuario actor se determina por la identidad Cognito validada por el middleware.

## Tabla

`internal-marketplace-auditoria-{entorno}`, aprovisionada por `infrastructure/template.yaml` con facturación `PAY_PER_REQUEST`.

| Campo | Tipo | Propósito |
| --- | --- | --- |
| `auditoriaId` | String (UUID, PK) | Identificador del evento |
| `tipoRegistro` | String | Partición de lectura `EVENTO` |
| `fechaId` | String (ISO 8601 + UUID) | Ordenar cronológicamente los eventos en GSI1 |
| `fecha` | String (ISO 8601 UTC) | Momento confirmado por el servidor |
| `usuarioId` | String | Actor autenticado, no tomado del cuerpo HTTP |
| `usuario` | String | Nombre de referencia del usuario al ocurrir el evento |
| `entidad`, `tipo`, `accion` | String | Clasificación y acción auditable |
| `descripcion`, `detalle` | String | Información no sensible, limitada a datos permitidos |
| `recursoId`, `ruta`, `metodo` | String | Referencia y operación ejecutada |

## Índices

- PK: `auditoriaId` (HASH).
- GSI1: `tipoRegistro` (HASH), `fechaId` (RANGE); proyección `ALL`. Consulta descendente por rangos de días locales de El Salvador.

## Seguridad y limitaciones

- Lectura: únicamente administradores activos mediante `GET /api/v1/administracion/auditoria`.
- Escritura: Lambdas autorizadas, después de respuestas exitosas de operaciones de cambio; no se aceptan solicitudes arbitrarias para crear eventos desde el navegador.
- No se almacenan contraseñas, tokens Cognito, payloads completos ni credenciales.
- Los eventos anteriores al despliegue no se recuperan automáticamente y nunca se atribuyen a usuarios sin evidencia. La tabla y sus rutas deben crearse/aplicarse mediante `sam deploy`: su declaración en código no equivale a su existencia en AWS.
- El registro de `INICIO_SESION` depende de que el frontend solicite `POST /api/v1/usuarios/yo/acceso` tras autenticación correcta; la simple navegación o consulta del perfil no genera otro inicio de sesión.
- La escritura de auditoría es de mejor esfuerzo después de confirmar la operación de negocio. Un fallo de persistencia se registra en CloudWatch y debe ser supervisado; no revierte los cambios de negocio ya realizados.
