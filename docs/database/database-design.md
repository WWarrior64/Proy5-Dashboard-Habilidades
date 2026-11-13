# Diseño de Base de Datos

**Universidad Católica de El Salvador – Cómputo en la Nube – Grupo B**

## Motor recomendado
Amazon DynamoDB (NoSQL) dentro del AWS Free Tier.

## Once tablas DynamoDB
Cada entidad tiene su propio archivo Markdown en `database/schemas/`:

| N.º | Tabla | Función | Clave primaria |
|-----|-------|---------|----------------|
| 1 | `internal-marketplace-usuarios-dev` | Cuentas, identidad y roles de acceso. | Simple (`usuarioId`) |
| 2 | `internal-marketplace-colaboradores-dev` | Perfiles profesionales de los empleados. | Simple (`colaboradorId`) |
| 3 | `internal-marketplace-cargos-dev` | Catálogo de cargos profesionales. | Simple (`cargoId`) |
| 4 | `internal-marketplace-habilidades-dev` | Catálogo de habilidades y tecnologías. | Simple (`habilidadId`) |
| 5 | `internal-marketplace-colaborador-habilidad-dev` | Relación colaborador-habilidad y nivel de dominio. | Compuesta (`colaboradorId`, `habilidadId`) |
| 6 | `internal-marketplace-proyectos-dev` | Requerimientos de proyectos internos. | Simple (`proyectoId`) |
| 7 | `internal-marketplace-proyecto-habilidad-dev` | Relación proyecto-habilidad requerida. | Compuesta (`proyectoId`, `habilidadId`) |
| 8 | `internal-marketplace-postulaciones-dev` | Solicitudes de participación en proyectos. | Compuesta (`proyectoId`, `postulacionKey`) |
| 9 | `internal-marketplace-asignaciones-dev` | Vinculación efectiva de colaboradores con proyectos. | Simple (`asignacionId`) |
| 10 | `internal-marketplace-administracion-dev` | Configuración administrativa y roles/permisos descriptivos. | Simple (`configuracionId`) |
| 11 | `internal-marketplace-auditoria-dev` | Eventos de operación e inicios de sesión autenticados. | Simple (`auditoriaId`) y GSI (`tipoRegistro`, `fechaId`) |

## Archivos de esquema
- `database/schemas/usuarios.md` → Entidad Usuarios (`internal-marketplace-usuarios-dev`)
- `database/schemas/colaboradores.md` → Entidad Colaboradores (`internal-marketplace-colaboradores-dev`)
- `database/schemas/cargos.md` → Entidad Cargos (`internal-marketplace-cargos-dev`)
- `database/schemas/habilidades.md` → Entidad Habilidades (`internal-marketplace-habilidades-dev`)
- `database/schemas/colaborador-habilidad.md` → Entidad ColaboradorHabilidad (`internal-marketplace-colaborador-habilidad-dev`)
- `database/schemas/proyectos.md` → Entidad Proyectos (`internal-marketplace-proyectos-dev`)
- `database/schemas/proyecto-habilidad.md` → Entidad ProyectoHabilidad (`internal-marketplace-proyecto-habilidad-dev`)
- `database/schemas/postulaciones.md` → Entidad Postulaciones (`internal-marketplace-postulaciones-dev`)
- `database/schemas/asignaciones.md` → Entidad Asignaciones (`internal-marketplace-asignaciones-dev`)
- `database/schemas/auditoria.md` → Entidad Auditoría (`internal-marketplace-auditoria-dev`)
- La configuración administrativa utiliza `configuracionId` en la tabla `internal-marketplace-administracion-dev`.

## Matriz de habilidades (relación N:M)
La relación entre Desarrolladores, Habilidades y Proyectos se modela como una matriz N:M, donde un colaborador puede tener múltiples habilidades y un proyecto puede requerir múltiples habilidades.

## Convención de claves compuestas
Para evitar nombres de atributos con caracteres especiales (`#`), las claves de ordenación compuestas se guardan en atributos físicos sencillos:
- `postulacionKey` en `internal-marketplace-postulaciones-dev` (guarda valor compuesto como `POSTULACION#colaboradorId`)
- `colaboradorFechaKey` en `internal-marketplace-asignaciones-dev` GSI1 (guarda `estado#fechaAsignacion`)
- `proyectoFechaKey` en `internal-marketplace-asignaciones-dev` GSI2 (guarda `estado#fechaAsignacion`)
- `estadoFechaKey` en `internal-marketplace-asignaciones-dev` GSI3 (guarda `fechaAsignacion#asignacionId`)
- `nivelColaboradorKey` en `internal-marketplace-colaborador-habilidad-dev` GSI1 (guarda `nivel#colaboradorId`)
- En ProyectoHabilidad, **GSI1 utiliza directamente** `habilidadId` (partición) y `proyectoId` (ordenación), sin el atributo auxiliar `proyectoHabilidadKey`.

## Relaciones entre las tablas
- **Usuario 1:0..1 Colaborador**: una cuenta tiene cero o un perfil. Los nuevos registros usan un ítem de reserva `USUARIO#<usuarioId>` en Colaboradores, creado en la misma transacción que el perfil para evitar duplicados concurrentes. Los perfiles históricos requieren reconciliación.
- **Colaborador N:M Habilidad**: Mediante `internal-marketplace-colaborador-habilidad-dev` (`colaboradorId` + `habilidadId`)
- **Colaborador 1:1 Cargo**: `internal-marketplace-colaboradores-dev.cargoId → internal-marketplace-cargos-dev.cargoId`
- **Proyecto N:M Habilidad**: Mediante `internal-marketplace-proyecto-habilidad-dev` (`proyectoId` + `habilidadId`)
- **Colaborador N:M Proyecto**: Mediante `internal-marketplace-asignaciones-dev` (confirmado) e `internal-marketplace-postulaciones-dev` (pendiente)

## Control atómico de dedicación
Al crear, aceptar, modificar, finalizar o desvincular asignaciones se usa `TransactWriteItems` para actualizar `Colaboradores.dedicacionReservada` junto con los registros relacionados. Una condición impide que la dedicación reservada quede fuera del rango 0–100 %, incluso ante solicitudes concurrentes. Los ítems históricos sin el atributo deben reconciliarse antes de nuevas reservas.

El mismo colaborador no puede ser asignado más de una vez al mismo proyecto, incluso si la relación anterior está desvinculada. Tampoco puede asignarse ni postularse al proyecto que él mismo dirige (`Colaboradores.usuarioId = Proyectos.liderId`), aunque **un líder sí puede participar como colaborador en proyectos ajenos**. La consulta personal `/api/v1/asignaciones/mias` se resuelve a partir de la identidad autenticada.

La tabla Usuarios registra `ultimoAcceso` mediante el flujo de inicio de sesión; la tabla Auditoría almacena nuevos eventos de cambios y accesos con `auditoriaId`, `fecha`, `usuarioId`, `entidad`, `tipo` y la referencia del recurso. No se atribuyen retroactivamente autores a eventos históricos sin datos verificables. La baja del colaborador es lógica y su reincorporación conserva el perfil e historial.