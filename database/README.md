# Base de Datos

Este directorio contiene los esquemas de datos del proyecto Internal Marketplace.

## Archivos
- `schemas/data-model.md` → Modelo de datos general (nueve tablas y relaciones).
- `schemas/usuarios.md` → Entidad Usuarios (`im_usuarios`).
- `schemas/colaboradores.md` → Entidad Colaboradores (`im_colaboradores`).
- `schemas/cargos.md` → Entidad Cargos (`im_cargos`).
- `schemas/habilidades.md` → Entidad Habilidades (`im_habilidades`).
- `schemas/colaborador-habilidad.md` → Entidad ColaboradorHabilidad (`im_colaborador_habilidad`).
- `schemas/proyectos.md` → Entidad Proyectos (`im_proyectos`).
- `schemas/proyecto-habilidad.md` → Entidad ProyectoHabilidad (`im_proyecto_habilidad`).
- `schemas/postulaciones.md` → Entidad Postulaciones (`im_postulaciones`).
- `schemas/asignaciones.md` → Entidad Asignaciones (`im_asignaciones`).

## Motor recomendado
Amazon DynamoDB (AWS Free Tier).

## Convención de nombres
Todas las tablas utilizan el prefijo `im_` (Internal Marketplace) seguido del nombre de la entidad en minúsculas con guiones bajos.