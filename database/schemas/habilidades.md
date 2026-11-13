# Esquema: Habilidades

Catálogo de habilidades técnicas. Contiene las tecnologías, herramientas y competencias que pueden asociarse a los colaboradores y a los proyectos.

## Nombre de tabla
`internal-marketplace-habilidades-dev`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| habilidadId | Sí (persistido) | String (UUID) | La creación acepta un ID proporcionado o genera un UUID. |
| nombre | Sí | String | Nombre de la habilidad, ejemplo: React, AWS, Python, JavaScript. |
| nombreNormalizado | Sí | String | Nombre normalizado para búsquedas y prevención de duplicados. |
| categoria | Sí | String | Categoría: FRONTEND, BACKEND, CLOUD, BASES_DE_DATOS, etc. |
| descripcion | No | String | Descripción de la habilidad. |
| estado | Sí | String | ACTIVO o INACTIVO. |
| fechaCreacion | Sí | String (ISO 8601) | Fecha de creación del registro. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |

## Claves e índices

- **Clave primaria:** `habilidadId` (String, simple).
- **GSI1:** Partición: `categoria`, Ordenación: `nombreNormalizado`. Permite consultar habilidades agrupadas por categoría.

## Patrones de consulta

1. `GET /habilidades/{habilidadId}` → GetItem por clave primaria `habilidadId`.
2. `GET /habilidades?categoria=FRONTEND` → Scan filtrado por `categoria` en el repositorio actual.
3. `GET /habilidades?categoria=FRONTEND&nombre=React` → Scan filtrado por categoría y coincidencia parcial de nombre.
4. `GET /habilidades/categorias` → Recorre el catálogo paginado y devuelve las categorías distintas.

## Reglas de negocio

- Las habilidades se administran mediante un catálogo central.
- Una transacción crea una reserva `UNIQUE#<nombreNormalizado>` para impedir duplicados por nombre normalizado; la unicidad no equipara sinónimos distintos.
- Las habilidades inactivas no se ofrecen para nuevas relaciones en ColaboradorHabilidad ni ProyectoHabilidad.
- Las vistas de gestión ocultan las habilidades desactivadas por defecto y las muestran cuando RRHH selecciona los filtros históricos. Al publicar un proyecto debe seleccionarse al menos una habilidad activa como requisito, con su nivel mínimo.