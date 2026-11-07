# Esquema: Cargos

Administración de cargos profesionales. Contiene el catálogo de cargos que RR. HH. podrá crear, modificar, consultar, activar y desactivar.

## Nombre de tabla
`internal-marketplace-cargos-dev`

## Campos

| Campo | Obligatorio | Tipo | Descripción |
|-------|-------------|------|-------------|
| cargoId | Sí | String (UUID) | Identificador único del cargo. |
| nombre | Sí | String | Nombre del cargo, ejemplo: Desarrollador, Diseñador, Analista. |
| descripcion | Sí | String | Descripción de las responsabilidades del cargo. |
| categoria | No | String | Agrupación del cargo, ejemplo: Tecnología, Diseño, Análisis. |
| estado | Sí | String | ACTIVO o INACTIVO. |
| fechaCreacion | Sí | String (ISO 8601) | Fecha de creación del cargo. |
| fechaActualizacion | Sí | String (ISO 8601) | Fecha de última modificación. |
| creadoPor | Sí | String | Usuario de RR. HH. que registró el cargo. |
| actualizadoPor | No | String | Usuario que realizó la última modificación. |

## Claves e índices

- **Clave primaria:** `cargoId` (String, simple).
- **GSI1:**
  - Partición: `estado`
  - Ordenación: `nombre`
  - Permite consultar los cargos activos y ordenarlos por nombre.

## Patrones de consulta

1. `GET /cargos/{cargoId}` → Query por clave primaria `cargoId`.
2. `GET /cargos?estado=ACTIVO` → Query GSI1 con partición `estado = 'ACTIVO'`.
3. `GET /cargos?estado=ACTIVO&nombreLike=Dev` → Query GSI1 con `estado = 'ACTIVO'` y filtro sobre `nombre`.

## Reglas de negocio

- RR. HH. administra este catálogo.
- No se permite eliminar físicamente un cargo que tenga colaboradores relacionados.
- Si deja de utilizarse, se cambia su estado a `INACTIVO`.
- No se asignan nuevos colaboradores a cargos inactivos.