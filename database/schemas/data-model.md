# Modelo de Datos

## Resumen de las nueve tablas DynamoDB

| N.º | Tabla | Función principal | Tipo de clave primaria |
|-----|-------|-------------------|------------------------|
| 1 | `im_usuarios` | Cuentas, identidad y roles de acceso. | Simple (`usuarioId`) |
| 2 | `im_colaboradores` | Perfiles profesionales de los empleados. | Simple (`colaboradorId`) |
| 3 | `im_cargos` | Catálogo de cargos profesionales. | Simple (`cargoId`) |
| 4 | `im_habilidades` | Catálogo de habilidades y tecnologías. | Simple (`habilidadId`) |
| 5 | `im_colaborador_habilidad` | Relación colaborador-habilidad y nivel. | Compuesta (`colaboradorId`, `habilidadId`) |
| 6 | `im_proyectos` | Requerimientos de proyectos internos. | Simple (`proyectoId`) |
| 7 | `im_proyecto_habilidad` | Relación proyecto-habilidad requerida. | Compuesta (`proyectoId`, `habilidadId`) |
| 8 | `im_postulaciones` | Solicitudes de participación en proyectos. | Compuesta (`proyectoId`, `POSTULACION#colaboradorId`) |
| 9 | `im_asignaciones` | Vinculación efectiva de colaboradores con proyectos. | Simple (`asignacionId`) |

## Relaciones entre las tablas

- **Usuario 1:N Colaborador**: Una cuenta de usuario puede tener un perfil de colaborador (`im_usuarios.usuarioId → im_colaboradores.usuarioId`).
- **Colaborador N:M Habilidad**: Mediante `im_colaborador_habilidad` (`colaboradorId` + `habilidadId`).
- **Colaborador 1:1 Cargo**: Un colaborador tiene un cargo (`im_colaboradores.cargoId → im_cargos.cargoId`).
- **Proyecto N:M Habilidad**: Mediante `im_proyecto_habilidad` (`proyectoId` + `habilidadId`).
- **Colaborador N:M Proyecto**: Mediante `im_asignaciones` (vinculación confirmada) e `im_postulaciones` (solicitudes pendientes).
- **Proyecto 1:N ProyectoHabilidad**: Un proyecto requiere muchas habilidades (`im_proyectos.proyectoId → im_proyecto_habilidad.proyectoId`).

## Nota importante

Este esquema es conceptual. En DynamoDB las relaciones se implementan mediante identificadores y consultas a tablas e índices, no mediante claves foráneas automáticas como en SQL.

## Correcciones al modelo anterior

1. El nivel Junior/Mid/Senior pertenece a `im_colaborador_habilidad`, porque un colaborador puede tener diferentes niveles en distintas habilidades. No se guarda un único `nivelHabilidad` en `im_colaboradores`.
2. El rol de acceso a la plataforma tiene una única fuente de verdad en `im_usuarios`. El cargo laboral se relaciona mediante `cargoId` con `im_cargos`. No se confunde el rol del sistema con el cargo profesional.