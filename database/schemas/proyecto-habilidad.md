# Esquema: ProyectoHabilidad

Matriz N:M de proyectos y habilidades. Relaciona los proyectos con las habilidades técnicas que necesitan para su ejecución.

## Nombre de tabla
`im_proyecto_habilidad`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| proyectoId | Sí | String (UUID) | Identificador del proyecto. |
| habilidadId | Sí | String (UUID) | Identificador de la habilidad requerida. |
| nivelMinimo | Sí | String | Nivel mínimo solicitado: JUNIOR, MID o SENIOR. |
| esObligatoria | Sí | Boolean | Indica si la habilidad es indispensable para el proyecto. |
| peso | No | Number | Importancia relativa de la habilidad para el filtrado de candidatos. |
| observaciones | No | String | Detalles adicionales del requisito. |
| fechaCreacion | Sí | String (ISO 8601) | Fecha en que se agregó el requisito. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |

## Claves e índices

- **Clave primaria compuesta:**
  - Partición: `proyectoId`
  - Ordenación: `habilidadId`
- **GSI1:**
  - Partición: `habilidadId`
  - Ordenación: `proyectoHabilidadKey` — atributo físico sencillo que guarda el valor compuesto (por ejemplo `proyectoId`). Permite consultar proyectos por habilidad.

## Patrones de consulta

1. `GET /proyectos/{proyectoId}/habilidades` → Query por clave primaria con `proyectoId = :id`.
2. `GET /habilidades/{habilidadId}/proyectos` → Query GSI1 con `habilidadId = :id`.
3. `GET /proyectos/{proyectoId}/habilidades-requeridas` → Query por clave primaria con filtro `esObligatoria = true`.

## Reglas de negocio

- Un proyecto no debe tener duplicada una misma habilidad requerida (clave compuesta única).
- El nivel mínimo debe pertenecer a JUNIOR, MID o SENIOR.
- `esObligatoria` permite distinguir entre habilidades indispensables y deseables.
- `peso` puede utilizarse en el algoritmo de coincidencia para dar mayor importancia a ciertos requisitos.