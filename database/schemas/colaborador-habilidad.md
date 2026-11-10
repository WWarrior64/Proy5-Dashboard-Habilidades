# Esquema: ColaboradorHabilidad

Matriz N:M de colaboradores y habilidades. Relaciona los colaboradores con sus habilidades y registra el nivel de dominio de cada una.

## Nombre de tabla
`internal-marketplace-colaborador-habilidad-dev`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| colaboradorId | Sí | String (UUID) | Identificador del colaborador. |
| habilidadId | Sí | String (UUID) | Identificador de la habilidad. |
| nivel | Sí | String | Nivel de dominio: JUNIOR, MID o SENIOR. |
| anosExperiencia | Sí | Number | Años de experiencia, por defecto 0; la API admite temporalmente `aniosExperiencia` como alias de entrada. |
| observaciones | No | String | Comentarios sobre el dominio de la habilidad. |
| fechaCreacion | Sí | String (ISO 8601) | Fecha en que se agregó la habilidad al perfil. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última actualización del nivel o experiencia. |

## Claves e índices

- **Clave primaria compuesta:**
  - Partición: `colaboradorId`
  - Ordenación: `habilidadId`
- **GSI1:**
  - Partición: `habilidadId`
  - Ordenación: `nivelColaboradorKey` — atributo físico sencillo que guarda el valor compuesto (por ejemplo `nivel#colaboradorId`). Permite buscar colaboradores por habilidad y nivel.

## Patrones de consulta

1. `GET /colaboradores/{colaboradorId}/habilidades` → Query por clave primaria con `colaboradorId = :id`.
2. `GET /api/v1/busqueda/colaboradores?habilidades=X&nivelMinimo=MID` → Usa el GSI1 de ColaboradorHabilidad y compara los niveles en la lógica de búsqueda.
3. La consulta interna `listarPorHabilidad(habilidadId)` admite paginación y filtros de nivel; no hay un endpoint público `GET /habilidades/{habilidadId}/colaboradores`.

## Reglas de negocio

- Un colaborador no puede tener duplicada una misma habilidad (clave compuesta única).
- El nivel debe pertenecer a JUNIOR, MID o SENIOR.
- El nivel puede actualizarse sin crear un nuevo registro (UpdateItem sobre la misma clave).
- Para buscar candidatos se consulta por habilidad y se compara el nivel requerido con el nivel del colaborador.