# Esquema: ColaboradorHabilidad

Matriz N:M de colaboradores y habilidades. Relaciona los colaboradores con sus habilidades y registra el nivel de dominio de cada una.

## Nombre de tabla
`im_colaborador_habilidad`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| colaboradorId | Sí | String (UUID) | Identificador del colaborador. |
| habilidadId | Sí | String (UUID) | Identificador de la habilidad. |
| nivel | Sí | String | Nivel de dominio: JUNIOR, MID o SENIOR. |
| aniosExperiencia | No | Number | Años de experiencia en la habilidad. |
| fechaUltimoUso | No | String (ISO 8601) | Fecha en que utilizó la habilidad por última vez. |
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
2. `GET /habilidades/{habilidadId}/colaboradores?nivel=SENIOR` → Query GSI1 con `habilidadId = :id` y filtro sobre `nivel`.
3. `GET /buscar-colaboradores?habilidadId=X&nivelMinimo=MID` → Query GSI1 con `habilidadId = :id`, ordenación `nivelColaboradorKey` comienza con el nivel requerido.

## Reglas de negocio

- Un colaborador no puede tener duplicada una misma habilidad (clave compuesta única).
- El nivel debe pertenecer a JUNIOR, MID o SENIOR.
- El nivel puede actualizarse sin crear un nuevo registro (UpdateItem sobre la misma clave).
- Para buscar candidatos se consulta por habilidad y se compara el nivel requerido con el nivel del colaborador.