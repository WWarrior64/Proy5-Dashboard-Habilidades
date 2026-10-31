# Diseño de Base de Datos

**Universidad Católica de El Salvador – Cómputo en la Nube – Grupo B**

## Motor recomendado
Amazon DynamoDB (NoSQL) dentro del AWS Free Tier. Alternativa: Amazon RDS (t2.micro/t3.micro) bajo la opción IaaS.

## Esquemas
Cada entidad tiene su propio archivo Markdown en `database/schemas/`:

- `usuarios.md` → Usuarios del sistema (credenciales, roles).
- `colaboradores.md` → Plantilla técnica (datos personales, nivel de habilidad).
- `habilidades.md` → Catálogo de habilidades (Tech Stack).
- `proyectos.md` → Proyectos internos (requerimientos, horas, estado).
- `postulaciones.md` → Postulaciones de colaboradores a proyectos.
- `asignaciones.md` → Asignaciones colaborador ↔ proyecto con % de dedicación.

## Matriz de habilidades (relación N:M)
La relación entre Desarrolladores, Habilidades y Proyectos se modela como una matriz N:M, donde un colaborador puede tener múltiples habilidades y un proyecto puede requerir múltiples habilidades.

## Tablas DynamoDB sugeridas
- `usuarios` (PK: usuarioId)
- `colaboradores` (PK: colaboradorId, GSI: rol, GSI: nivelHabilidad)
- `habilidades` (PK: habilidadId)
- `proyectos` (PK: proyectoId, GSI: estado)
- `asignaciones` (PK: asignacionId, GSI: colaboradorId, GSI: proyectoId)
- `postulaciones` (PK: postulacionId, GSI: colaboradorId, GSI: proyectoId)