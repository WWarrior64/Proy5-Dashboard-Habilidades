# Esquema: ProyectoHabilidad

Matriz N:M de proyectos y habilidades. Relaciona los proyectos con las habilidades técnicas que necesitan para su ejecución.

## Nombre de tabla
`internal-marketplace-proyecto-habilidad-dev`

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
  - Ordenación: `proyectoId` directamente; no se define `proyectoHabilidadKey` en AWS SAM.

## Patrones de consulta

1. `GET /proyectos/{proyectoId}/habilidades` → Query por clave primaria con `proyectoId = :id`.
2. El repositorio `consultarProyectosPorHabilidad(habilidadId)` utiliza el GSI1 para búsquedas internas; no está expuesto como `GET /habilidades/{habilidadId}/proyectos`.
3. El endpoint publicado permite `POST`, `PUT` y `DELETE` en `/api/v1/proyectos/{proyectoId}/habilidades`; `GET` devuelve sus relaciones.

## Reglas de negocio

- Un proyecto no debe tener duplicada una misma habilidad requerida (clave compuesta única).
- El nivel mínimo debe pertenecer a JUNIOR, MID o SENIOR.
- `esObligatoria` permite distinguir entre habilidades indispensables y deseables.
- `peso` se valida como número no negativo y queda almacenado para una futura ponderación; la búsqueda actual calcula coincidencias sin ponderarlo.
- La asociación requiere un proyecto no finalizado y una habilidad activa.