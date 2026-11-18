# Contrato del Buscador de Candidatos

## Endpoint

**GET** `/api/v1/busqueda/colaboradores`

Obtiene candidatos colaboradores que cumplen con los requisitos de habilidades, ya sea por búsqueda manual de habilidades o por los requisitos registrados de un proyecto.

## Parámetros de consulta (Query String)

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
|-----------|------|-------------|-------------------|-------------|
| `habilidades` | string | No* | `''` | IDs de habilidad separados por coma (ej. `hab_react,hab_sql`). |
| `proyectoId` | string | No* | `null` | ID del proyecto para usar sus habilidades requeridas registradas. |
| `nivelMinimo` | string | No | `JUNIOR` | Nivel mínimo general para búsqueda manual: `JUNIOR`, `MID`, `SENIOR`. |
| `tipoCoincidencia` | string | No | `todas` | `todas` = cumplir todas; `alguna` = al menos una. |
| `considerarDisponibilidad` | string | No | `true` | `true` o `false`. Filtra inactivos y sin dedicación disponible. |
| `limit` | number | No | `50` | Límite máximo de resultados (1-100). |

* Se requiere al menos `habilidades` o `proyectoId`. Si ambos, `proyectoId` tiene prioridad.

## Requisitos por proyecto (`proyectoId`)

Cuando se proporciona `proyectoId`, el buscador consulta el repositorio `proyecto-habilidad.repository` (`consultarHabilidadesProyecto`) para obtener, por cada habilidad requerida: `nivelMinimo`, `esObligatoria` y `peso`.

La búsqueda manual por habilidades (`habilidades` sin `proyectoId`) se mantiene; cada habilidad se trata como opcional con peso `1` y el `nivelMinimo` general.

## Criterio de elegibilidad (política)

| Requisito | Comportamiento |
|-----------|----------------|
| Habilidad obligatoria cumplida | El colaborador continúa en la evaluación |
| Habilidad obligatoria incumplida | El colaborador **no es elegible** (no aparece en resultados) |
| Habilidad opcional cumplida | Mejora la puntuación del candidato |
| Habilidad opcional incumplida | No impide la selección, pero reduce la puntuación |

La comparación de niveles respeta la jerarquía: `JUNIOR < MID < SENIOR`.

## Puntuación ponderada

La puntuación se calcula entre 0 y 100 % usando los pesos de los requisitos:

- `puntuacion = (suma de pesos cumplidos / suma de pesos totales) * 100`
- Si hay obligatorias incumplidas: `puntuacion = 0` y el colaborador no es elegible.
- Si ninguna habilidad tiene peso (todos por defecto `1`): puntuación simple por cantidad.
- Si el peso es `0`: se incluye en el total pero no aporta puntuación al cumplirse.
- Si existen requisitos opcionales: su peso contribuye al total y al cumplido, pero no bloquean la elegibilidad.

## Respuesta

### Cuerpo de éxito (HTTP 200)

```json
{
  "datos": {
    "total": 12,
    "devueltos": 5,
    "candidatos": [
      {
        "colaboradorId": "col_1",
        "usuarioId": "usr_1",
        "cargoId": "crg_1",
        "rolProfesional": "Fullstack Developer",
        "estado": "ACTIVO",
        "disponibilidad": "disponible",
        "dedicacionReservada": 20,
        "dedicacionDisponible": 80,
        "puntuacion": 85,
        "elegible": true,
        "habilidadesCoincidentes": [
          {
            "habilidadId": "hab_react",
            "nivelPoseido": "SENIOR",
            "nivelRequerido": "MID",
            "esObligatoria": true,
            "peso": 3,
            "anosExperiencia": 5,
            "observaciones": null
          }
        ],
        "habilidadesFaltantes": [
          {
            "habilidadId": "hab_go",
            "nivelPoseido": null,
            "nivelRequerido": "SENIOR",
            "esObligatoria": false,
            "peso": 1,
            "anosExperiencia": null,
            "observaciones": null
          }
        ],
        "detalles": {
          "totalRequisitos": 3,
          "totalCumplidos": 2,
          "totalFaltantes": 1,
          "totalObligatoriosIncumplidos": 0
        }
      }
    ],
    "criterios": {
      "tipo": "proyecto",
      "proyectoId": "proj_1",
      "requisitos": [],
      "considerarDisponibilidad": true,
      "limit": 50
    }
  }
}
```

Cuando la búsqueda es manual, `criterios` contiene `habilidadesRequeridas`, `nivelMinimo` y `tipoCoincidencia`.

### Campos del candidato

| Campo | Descripción |
|-------|-------------|
| `colaboradorId` | Identificador único del colaborador |
| `usuarioId` | ID del usuario vinculado |
| `cargoId` | ID del cargo profesional |
| `rolProfesional` | Rol profesional del colaborador |
| `estado` | Estado del colaborador (`ACTIVO`, `INACTIVO`, etc.) |
| `disponibilidad` | Motivo de disponibilidad o `"disponible"` |
| `dedicacionReservada` | Porcentaje de dedicación reservada (o `null`) |
| `dedicacionDisponible` | Porcentaje de dedicación disponible (o `null`) |
| `puntuacion` | Puntuación ponderada entre 0 y 100 |
| `elegible` | Si cumple todas las obligatorias y está disponible |
| `habilidadesCoincidentes` | Detalle de habilidades cumplidas |
| `habilidadesFaltantes` | Detalle de habilidades no cumplidas |
| `detalles` | Resumen de totales |

### Respuesta sin coincidencias (HTTP 200)

```json
{
  "datos": {
    "total": 0,
    "devueltos": 0,
    "candidatos": [],
    "criterios": { ... }
  }
}
```

## Errores de validación (HTTP 400)

| Condición |
|-----------|
| No se proporciona `habilidades` ni `proyectoId` |
| `limit` no es entero entre 1 y 100 |
| `considerarDisponibilidad` no es `"true"` ni `"false"` |
| `nivelMinimo` no es `JUNIOR`, `MID` o `SENIOR` |
| `tipoCoincidencia` no es `"todas"` ni `"alguna"` |

## Errores de negocio

| Código HTTP | Condición |
|-------------|-----------|
| 404 | El proyecto no tiene habilidades requeridas registradas |
| 500 | Error interno del servidor |

## Paginación y límites

- DynamoDB usa paginación mediante `LastEvaluatedKey` en `listarPorHabilidad`.
- Los resultados duplicados se eliminan mediante un mapa claveado por `colaboradorId`.
- El límite de respuesta se aplica tras ordenar por puntuación descendente.
- Varias habilidades se consultan por separado y los colaboradores se agrupan por ID.

## Consistencia entre modos

La respuesta de búsqueda manual y por proyecto es coherente: mismos campos de candidato, puntuación ponderada, habilidades cumplidas/faltantes, disponibilidad y criterios.