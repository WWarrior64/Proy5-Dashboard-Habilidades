# Esquema: Habilidades

Catálogo de habilidades técnicas. Contiene las tecnologías, herramientas y competencias que pueden asociarse a los colaboradores y a los proyectos.

## Nombre de tabla
`im_habilidades`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| habilidadId | Sí | String (UUID) | Identificador UUID de la habilidad. |
| nombre | Sí | String | Nombre de la habilidad, ejemplo: React, AWS, Python, JavaScript. |
| nombreNormalizado | Sí | String | Nombre normalizado para búsquedas y prevención de duplicados. |
| categoria | Sí | String | Categoría: FRONTEND, BACKEND, CLOUD, BASES_DE_DATOS, etc. |
| descripcion | No | String | Descripción de la habilidad. |
| estado | Sí | String | ACTIVA o INACTIVA. |
| fechaCreacion | Sí | String (ISO 8601) | Fecha de creación del registro. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |

## Claves e índices

- **Clave primaria:** `habilidadId` (String, simple).
- **GSI1:** Partición: `categoria`, Ordenación: `nombreNormalizado`. Permite consultar habilidades agrupadas por categoría.

## Patrones de consulta

1. `GET /habilidades/{habilidadId}` → Query por clave primaria `habilidadId`.
2. `GET /habilidades?categoria=FRONTEND` → Query GSI1 con `categoria = 'FRONTEND'`.
3. `GET /habilidades?categoria=FRONTEND&nombreLike=React` → Query GSI1 con `categoria = 'FRONTEND'` y filtro sobre `nombreNormalizado`.

## Reglas de negocio

- Las habilidades se administran mediante un catálogo central.
- Se evita registrar varias veces una misma habilidad con nombres diferentes (validar `nombreNormalizado` antes de crear).
- Las habilidades inactivas no se ofrecen para nuevas relaciones en ColaboradorHabilidad ni ProyectoHabilidad.