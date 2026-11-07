# Modelo de Datos

## Resumen de las nueve tablas DynamoDB

| N.º | Tabla | Función principal | Tipo de clave primaria |
|-----|-------|-------------------|------------------------|
| 1 | `internal-marketplace-usuarios-dev` | Cuentas, identidad y roles de acceso. | Simple (`usuarioId`) |
| 2 | `internal-marketplace-colaboradores-dev` | Perfiles profesionales de los empleados. | Simple (`colaboradorId`) |
| 3 | `internal-marketplace-cargos-dev` | Catálogo de cargos profesionales. | Simple (`cargoId`) |
| 4 | `internal-marketplace-habilidades-dev` | Catálogo de habilidades y tecnologías. | Simple (`habilidadId`) |
| 5 | `internal-marketplace-colaborador-habilidad-dev` | Relación colaborador-habilidad y nivel. | Compuesta (`colaboradorId`, `habilidadId`) |
| 6 | `internal-marketplace-proyectos-dev` | Requerimientos de proyectos internos. | Simple (`proyectoId`) |
| 7 | `internal-marketplace-proyecto-habilidad-dev` | Relación proyecto-habilidad requerida. | Compuesta (`proyectoId`, `habilidadId`) |
| 8 | `internal-marketplace-postulaciones-dev` | Solicitudes de participación en proyectos. | Compuesta (`proyectoId`, `postulacionKey`) |
| 9 | `internal-marketplace-asignaciones-dev` | Vinculación efectiva de colaboradores con proyectos. | Simple (`asignacionId`) |

## Relaciones entre las tablas

- **Usuario 1:N Colaborador**: Una cuenta de usuario puede tener un perfil de colaborador (`internal-marketplace-usuarios-dev.usuarioId → internal-marketplace-colaboradores-dev.usuarioId`).
- **Colaborador N:M Habilidad**: Mediante `internal-marketplace-colaborador-habilidad-dev` (`colaboradorId` + `habilidadId`).
- **Colaborador 1:1 Cargo**: Un colaborador tiene un cargo (`internal-marketplace-colaboradores-dev.cargoId → internal-marketplace-cargos-dev.cargoId`).
- **Proyecto N:M Habilidad**: Mediante `internal-marketplace-proyecto-habilidad-dev` (`proyectoId` + `habilidadId`).
- **Colaborador N:M Proyecto**: Mediante `internal-marketplace-asignaciones-dev` (vinculación confirmada) e `internal-marketplace-postulaciones-dev` (solicitudes pendientes).
- **Proyecto 1:N ProyectoHabilidad**: Un proyecto requiere muchas habilidades (`internal-marketplace-proyectos-dev.proyectoId → internal-marketplace-proyecto-habilidad-dev.proyectoId`).

## Nota importante

Este esquema es conceptual. En DynamoDB las relaciones se implementan mediante identificadores y consultas a tablas e índices, no mediante claves foráneas automáticas como en SQL.

## Correcciones al modelo anterior

1. El nivel Junior/Mid/Senior pertenece a `internal-marketplace-colaborador-habilidad-dev`, porque un colaborador puede tener diferentes niveles en distintas habilidades. No se guarda un único `nivelHabilidad` en `internal-marketplace-colaboradores-dev`.
2. El rol de acceso a la plataforma tiene una única fuente de verdad en `internal-marketplace-usuarios-dev`. El cargo laboral se relaciona mediante `cargoId` con `internal-marketplace-cargos-dev`. No se confunde el rol del sistema con el cargo profesional.