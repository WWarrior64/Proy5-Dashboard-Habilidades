# Diseño de Base de Datos

**Universidad Católica de El Salvador – Cómputo en la Nube – Grupo B**

## Motor recomendado
Amazon DynamoDB (NoSQL) dentro del AWS Free Tier.

## Nueve tablas DynamoDB
Cada entidad tiene su propio archivo Markdown en `database/schemas/`:

| N.º | Tabla | Función | Clave primaria |
|-----|-------|---------|----------------|
| 1 | `im_usuarios` | Cuentas, identidad y roles de acceso. | Simple (`usuarioId`) |
| 2 | `im_colaboradores` | Perfiles profesionales de los empleados. | Simple (`colaboradorId`) |
| 3 | `im_cargos` | Catálogo de cargos profesionales. | Simple (`cargoId`) |
| 4 | `im_habilidades` | Catálogo de habilidades y tecnologías. | Simple (`habilidadId`) |
| 5 | `im_colaborador_habilidad` | Relación colaborador-habilidad y nivel de dominio. | Compuesta (`colaboradorId`, `habilidadId`) |
| 6 | `im_proyectos` | Requerimientos de proyectos internos. | Simple (`proyectoId`) |
| 7 | `im_proyecto_habilidad` | Relación proyecto-habilidad requerida. | Compuesta (`proyectoId`, `habilidadId`) |
| 8 | `im_postulaciones` | Solicitudes de participación en proyectos. | Compuesta (`proyectoId`, `postulacionKey`) |
| 9 | `im_asignaciones` | Vinculación efectiva de colaboradores con proyectos. | Simple (`asignacionId`) |

## Archivos de esquema
- `database/schemas/usuarios.md` → Entidad Usuarios (`im_usuarios`)
- `database/schemas/colaboradores.md` → Entidad Colaboradores (`im_colaboradores`)
- `database/schemas/cargos.md` → Entidad Cargos (`im_cargos`)
- `database/schemas/habilidades.md` → Entidad Habilidades (`im_habilidades`)
- `database/schemas/colaborador-habilidad.md` → Entidad ColaboradorHabilidad (`im_colaborador_habilidad`)
- `database/schemas/proyectos.md` → Entidad Proyectos (`im_proyectos`)
- `database/schemas/proyecto-habilidad.md` → Entidad ProyectoHabilidad (`im_proyecto_habilidad`)
- `database/schemas/postulaciones.md` → Entidad Postulaciones (`im_postulaciones`)
- `database/schemas/asignaciones.md` → Entidad Asignaciones (`im_asignaciones`)

## Matriz de habilidades (relación N:M)
La relación entre Desarrolladores, Habilidades y Proyectos se modela como una matriz N:M, donde un colaborador puede tener múltiples habilidades y un proyecto puede requerir múltiples habilidades.

## Convención de claves compuestas
Para evitar nombres de atributos con caracteres especiales (`#`), las claves de ordenación compuestas se guardan en atributos físicos sencillos:
- `postulacionKey` en `im_postulaciones` (guarda valor compuesto como `POSTULACION#colaboradorId`)
- `colaboradorFechaKey` en `im_asignaciones` GSI1 (guarda `estado#fechaAsignacion`)
- `proyectoFechaKey` en `im_asignaciones` GSI2 (guarda `estado#fechaAsignacion`)
- `estadoFechaKey` en `im_asignaciones` GSI3 (guarda `fechaAsignacion#asignacionId`)
- `nivelColaboradorKey` en `im_colaborador_habilidad` GSI1 (guarda `nivel#colaboradorId`)
- `proyectoHabilidadKey` en `im_proyecto_habilidad` GSI1 (guarda `proyectoId`)

## Relaciones entre las tablas
- **Usuario 1:N Colaborador**: `im_usuarios.usuarioId → im_colaboradores.usuarioId`
- **Colaborador N:M Habilidad**: Mediante `im_colaborador_habilidad` (`colaboradorId` + `habilidadId`)
- **Colaborador 1:1 Cargo**: `im_colaboradores.cargoId → im_cargos.cargoId`
- **Proyecto N:M Habilidad**: Mediante `im_proyecto_habilidad` (`proyectoId` + `habilidadId`)
- **Colaborador N:M Proyecto**: Mediante `im_asignaciones` (confirmado) e `im_postulaciones` (pendiente)

## Control atómico de dedicación
Al crear o actualizar una asignación en `im_asignaciones`, los repositorios deben usar TransactWriteItems o UpdateItem con ConditionExpression para verificar que la suma de `porcentajeDedicacion` de asignaciones `ACTIVA` del colaborador no exceda el 100 %.