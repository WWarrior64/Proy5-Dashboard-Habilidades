# Base de Datos

Este directorio contiene los esquemas de datos del proyecto Internal Marketplace.

## Archivos
- `schemas/data-model.md` → Modelo de datos general (nueve tablas y relaciones).
- `schemas/usuarios.md` → Entidad Usuarios (`internal-marketplace-usuarios-dev`).
- `schemas/colaboradores.md` → Entidad Colaboradores (`internal-marketplace-colaboradores-dev`).
- `schemas/cargos.md` → Entidad Cargos (`internal-marketplace-cargos-dev`).
- `schemas/habilidades.md` → Entidad Habilidades (`internal-marketplace-habilidades-dev`).
- `schemas/colaborador-habilidad.md` → Entidad ColaboradorHabilidad (`internal-marketplace-colaborador-habilidad-dev`).
- `schemas/proyectos.md` → Entidad Proyectos (`internal-marketplace-proyectos-dev`).
- `schemas/proyecto-habilidad.md` → Entidad ProyectoHabilidad (`internal-marketplace-proyecto-habilidad-dev`).
- `schemas/postulaciones.md` → Entidad Postulaciones (`internal-marketplace-postulaciones-dev`).
- `schemas/asignaciones.md` → Entidad Asignaciones (`internal-marketplace-asignaciones-dev`).

## Motor recomendado
Amazon DynamoDB (AWS Free Tier).

## Convención de nombres
Todas las tablas utilizan el prefijo `im_` (Internal Marketplace) seguido del nombre de la entidad en minúsculas con guiones bajos.