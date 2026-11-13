# Contexto del Proyecto para el Equipo

Este documento describe en tercera persona el estado actual del proyecto, los archivos creados, las ubicaciones clave y los próximos pasos. Su propósito es permitir que cualquier miembro del equipo sin contexto previo entienda qué se ha hecho, dónde buscar cada cosa y qué queda por realizar.

## 1. Estado General del Proyecto

Se ha creado la estructura completa de carpetas y archivos base del proyecto "Proy5-Dashboard-Habilidades" (Dashboard de Gestión de Talento y Habilidades Internas / Internal Marketplace) para la Universidad Católica de El Salvador, curso Cómputo en la nube – Grupo B, docente Ing. Herberth Contreras.

El proyecto está dividido en tres capas principales: frontend/ (React + Vite), backend/ (Node.js + Express) y database/ (esquemas Markdown). Además se incluyen infrastructure/, postman/, docs/, .github/ y archivos de configuración raíz.

Ruta absoluta: c:\Users\Galex\Documents\Proyecto Final Computo en la Nube\Proy5-Dashboard-Habilidades
Entorno: Windows, PowerShell, Node.js v24, npm v10.9.3

## 2. Archivos y Carpetas Creadas (Estado Actual)

### 2.1 Raíz del proyecto

| Archivo | Descripción |
|---|---|
| package.json | Workspace con frontend y backend |
| .gitignore | Ignora node_modules, dist, .env, logs, IDE, AWS (.aws-sam, samconfig.toml) |
| .editorconfig | Estándar de código (UTF-8, indent 2, LF) |
| README.md | Documentación general del proyecto |

### 2.2 Frontend (frontend/)

Se instaló React 18, Vite, React Router DOM, Axios y Lucide React. Se ejecutó npm install y npm run build con éxito.

Archivos de configuración: frontend/package.json, frontend/vite.config.js, frontend/eslint.config.js, frontend/index.html, frontend/.env.example, frontend/.gitignore.

Código fuente (frontend/src/): main.jsx, App.jsx, context/AuthContext.jsx, hooks/useAuth.js, hooks/usePermissions.js, services/api.js, services/*.service.js, utils/constants.js, utils/validators.js, utils/formatters.js, utils/permissions.js, styles/variables.css, styles/global.css, styles/components.css.

Componentes (frontend/src/components/): layout/ (6 archivos), dashboard/ (4), colaboradores/ (4), proyectos/ (4), habilidades/ (3), asignaciones/ (4), postulaciones/ (3), usuarios/ (3), common/ (7).

Páginas (frontend/src/pages/): Login.jsx, NotFound.jsx, Colaboradores.jsx, Proyectos.jsx, Habilidades.jsx, Asignaciones.jsx, Postulaciones.jsx, Usuarios.jsx, Perfil.jsx, dashboards/ (4 dashboards por rol).

### 2.3 Backend (backend/)

Se instaló Express, CORS, Dotenv, AWS SDK v3, UUID, Joi.

Archivos de configuración: backend/package.json, backend/.env.example, backend/eslint.config.js (ESLint 9 Flat Config), backend/src/config/environment.js, backend/src/config/dynamodb.js.

Handlers (backend/src/functions/*/handler.js): health, usuarios, colaboradores, cargos, habilidades, proyectos, postulaciones, asignaciones, busqueda, dashboard.

Servicios (backend/src/services/): filtering.service.js, cache.service.js, authorization.service.js, dedicacion.service.js.

Repositorios (backend/src/repositories/): colaboradores, proyectos, habilidades, asignaciones, postulaciones, usuarios, cargos, colaborador-habilidad, proyecto-habilidad, dashboard.

Middleware (backend/src/middleware/): authentication.js, authorization.js, validation.js, route-policy.js.

Utils (backend/src/utils/): responses.js, validators.js, errors.js, lambda-dispatcher.js.

Tests (backend/tests/): colaboradores.test.js, proyectos.test.js, asignaciones.test.js, filtering.test.js, postulaciones.test.js, usuarios.test.js, cargos.test.js, habilidades.test.js, colaborador-habilidad.test.js, cargos.repository.test.js, security.test.js.

Tests de integración (backend/tests/integration/): local.integration.test.js (solo con DynamoDB Local y RUN_LOCAL_INTEGRATION=true).

### 2.4 Base de Datos (database/)

Archivos: database/README.md y database/schemas/ (data-model.md, usuarios.md, colaboradores.md, cargos.md, habilidades.md, colaborador-habilidad.md, proyectos.md, proyecto-habilidad.md, postulaciones.md, asignaciones.md). Todos en Markdown definiendo campos, claves compuestas y GSIs bajo convención `internal-marketplace-<entidad>-<entorno>`.

> Nota histórica: originalmente las tablas usaban la convención `im_*` (ej. `im_usuarios`, `im_colaboradores`). Fue unificada a `internal-marketplace-*-<entorno>` en el commit `fix/unificar-nombres-dynamodb` para alinearse con los nombres definidos en `infrastructure/template.yaml`.

### 2.5 Infraestructura (infrastructure/)

Archivos: infrastructure/template.yaml (AWS SAM con 10 funciones Lambda modulares, 9 tablas DynamoDB, API Gateway `/api/v1`, bucket S3 privado con Origin Access Control y CloudFront CDN) e infrastructure/README.md.

### 2.6 Postman (postman/)

Archivos:
- `postman/internal-marketplace.postman_collection.json`: Colección completa organizada en 10 carpetas modulares (00 a 09) con pruebas automáticas integradas.
- `postman/internal-marketplace.postman_environment.json`: Entorno con variables (`baseUrl`, `token`, IDs dinámicos).
- `postman/README.md`: Guía de importación, autenticación y secuencia de prueba.

### 2.7 Documentación (docs/)

Archivos: docs/architecture/architecture.md (Arquitectura Serverless 2.0.0), docs/api/api-documentation.md (Catálogo de 10 módulos en `/api/v1`), docs/database/database-design.md, docs/figma/prototype-guide.md, docs/team/responsibilities.md.

### 2.8 CI/CD (.github/)

Archivo: .github/workflows/deploy.yml (pipeline de GitHub Actions configurado con Node.js 24, linter, tests Jest `runInBand`, build de frontend y `sam validate` / `sam build`).

---

## 3. Estado Funcional Consolidado

| Parte | Estado | Observación |
|---|---|---|
| Estructura de carpetas | Completa | Coincide con la arquitectura desacoplada |
| Dependencias frontend | Instaladas | React 18 + Vite |
| Dependencias backend | Instaladas | AWS SDK v3 y Node 24 |
| Calidad Backend | Configurada | `backend/eslint.config.js` activo con reglas base |
| Infraestructura SAM | Validada | 10 funciones declaradas con rutas `/api/v1` y 9 tablas NoSQL |
| CI/CD | Operativo | Workflow en Node 24 sin despliegue prematuro |
| Postman | Completo | 10 módulos con aserciones y variables dinámicas |
| Documentación técnica | Al día | API y arquitectura sincronizadas con SAM y Cognito |

---

## 4. Dónde Buscar Cada Cosa (Guía Rápida)

| Si necesitas... | Busca en este archivo/carpeta |
|---|---|
| Conexión a DynamoDB | backend/src/config/dynamodb.js |
| Variables de entorno backend | backend/src/config/environment.js |
| Reglas de ESLint backend | backend/eslint.config.js |
| Plantilla de infraestructura serverless | infrastructure/template.yaml |
| Colección y entorno Postman | postman/ |
| Pipeline de CI/CD | .github/workflows/deploy.yml |
| Contrato y catálogo de endpoints | docs/api/api-documentation.md |
| Diagrama y flujo de arquitectura | docs/architecture/architecture.md |
| Modelos de datos NoSQL | database/schemas/ |

---

## 5. Registro de Cambios - Módulo CI/CD e Infraestructura (Integrante 5: Diego Ernesto Portillo Alfaro)

Rama oficial: `feature/integracion-infraestructura`

### 5.1 Calidad de Código y Estilo (backend/eslint.config.js)
- Se configuró la versión plana (`Flat Config`) de ESLint 9 para el entorno Backend CommonJS.
- Reglas aplicadas: `camelcase` estricto en propiedades, `semi` obligatorio, comillas simples (`quotes: single`), `no-unused-vars` con excepción para argumentos `^_`, y desactivación de restricción en `console`.

### 5.2 Plantilla Serverless AWS SAM (infrastructure/template.yaml)
- Se actualizó el runtime global a `nodejs24.x`.
- Se corrigieron los nombres de variables de entorno para que utilicen el prefijo estandarizado `TABLE_<ENTIDAD>` (`TABLE_USUARIOS`, `TABLE_COLABORADORES`, etc.) en sincronía con `backend/src/config/environment.js`.
- Se declararon de forma modular las 10 funciones Lambda del sistema (`HealthFunction`, `UsuariosFunction`, `ColaboradoresFunction`, `CargosFunction`, `HabilidadesFunction`, `ProyectosFunction`, `PostulacionesFunction`, `AsignacionesFunction`, `BusquedaFunction` y `DashboardFunction`).
- Se definieron las políticas IAM de mínimo privilegio (`DynamoDBCrudPolicy` y `DynamoDBReadPolicy`) mapeadas tabla por tabla.
- Se enrutaron todos los eventos hacia el recurso unificado `InternalMarketplaceApi` bajo el prefijo `/api/v1/`.
- Validación sintáctica y de linter superada con `sam validate --lint`.

### 5.3 Pruebas Automatizadas y Colección (postman/)
- Se reestructuró la colección `postman/internal-marketplace.postman_collection.json` pasando de 2 endpoints obsoletos a 10 módulos funcionales (00 a 09) alineados con la API v1.
- Se incorporaron aserciones automatizadas de pruebas en Postman (validación de código HTTP 200/201, estructura JSON y guardado automático de variables de entorno como `usuarioId`, `colaboradorId`, `habilidadId`, `proyectoId`, `asignacionId`).
- Se generó el archivo de variables `postman/internal-marketplace.postman_environment.json`.
- Se documentó la secuencia de prueba en `postman/README.md`.

### 5.4 Flujo de Integración Continua (.github/workflows/deploy.yml)
- Se actualizó el pipeline para ejecutar sobre Node.js 24 en los runners de GitHub Actions.
- Se corrigió la variable de entorno a `AWS_DEFAULT_REGION: us-east-2`.
- Se estructuraron los jobs de validación para ejecutar linter, pruebas Jest no interactivas (`--runInBand`), compilación del frontend (`npm run build`) y validación/empaquetado con `sam validate` y `sam build`.
- Se deshabilitó el auto-deploy por seguridad presupuestaria del Free Tier.

### 5.5 Documentación Técnica (docs/)
- Se sincronizó `docs/api/api-documentation.md` con las 10 funciones modulares, clarificando que la autenticación es delegada a Cognito User Pools (sin endpoints express manuales `/auth/login`).
- Se actualizó `docs/architecture/architecture.md` detallando la integración S3 + CloudFront (OAC), API Gateway, Lambda Node 24, DynamoDB On-Demand, transacciones atómicas (`TransactWriteItems`) y estrategia de caché.
| Lógica CRUD colaboradores | backend/src/functions/colaboradores/handler.js + backend/src/repositories/colaboradores.repository.js |
| Lógica CRUD proyectos | backend/src/functions/proyectos/handler.js |
| Lógica CRUD habilidades | backend/src/functions/habilidades/handler.js |
| Lógica CRUD asignaciones | backend/src/functions/asignaciones/handler.js |
| Lógica CRUD postulaciones | backend/src/functions/postulaciones/handler.js |
| Lógica CRUD usuarios | backend/src/functions/usuarios/handler.js |
| Servicios de negocio | backend/src/services/ |
| Middleware de seguridad | backend/src/middleware/ |
| Utilidades de respuesta/error | backend/src/utils/ |
| Pruebas unitarias | backend/tests/ |
| Cliente HTTP Axios | frontend/src/services/api.js |
| Servicios del frontend | frontend/src/services/*.service.js |
| Contexto de autenticación | frontend/src/context/AuthContext.jsx |
| Hooks de auth y permisos | frontend/src/hooks/ |
| Rutas y navegación SPA | frontend/src/App.jsx |
| Layout principal | frontend/src/components/layout/MainLayout.jsx |
| Componentes comunes | frontend/src/components/common/ |
| Páginas por rol | frontend/src/pages/dashboards/ |
| Estilos globales | frontend/src/styles/global.css, variables.css, components.css |
| Variables de entorno frontend | frontend/.env.example |
| Variables de entorno backend | backend/.env.example |
| Colección Postman | postman/internal-marketplace.postman_collection.json |
| Infraestructura AWS | infrastructure/template.yaml |
| Arquitectura documentada | docs/architecture/architecture.md |
| Diseño de base de datos | docs/database/database-design.md, database/schemas/*.md |
| Documentación API | docs/api/api-documentation.md |
| CI/CD | .github/workflows/deploy.yml |

## 6. Convenciones y Estándares Aplicados

- Lenguaje: JavaScript (no TypeScript).
- Estilos: CSS puro con variables CSS (:root) y clases utilitarias estilo Tailwind (sin instalar Tailwind).
- Componentes: funcionales con export default.
- Rutas del backend: REST bajo /api (por implementar completamente en index.js).
- Autenticación: JWT en localStorage, interceptor en Axios, redirección automática en 401.
- Ignorados en git: node_modules, dist, .env, .aws, logs, carpetas de IDE.

## 7. Comandos Útiles

Desde la raíz del proyecto:

cd frontend && npm install      # Instalar dependencias del frontend
cd frontend && npm run dev      # Iniciar frontend (puerto 5173)
cd frontend && npm run build    # Build de producción

cd backend && npm install       # Instalar dependencias del backend
cd backend && npm start         # Iniciar backend (puerto 3000)

AWS (requiere CLI configurado):
aws cloudformation create-stack --stack-name internal-marketplace --template-body file://infrastructure/template.yaml

## 8. Registro de Cambios de CI/CD (GitHub Actions)

Se realizaron los siguientes ajustes para que el flujo de despliegue pase sin errores:

### 8.1 Configuración de ESLint para JSX (frontend)
- Archivos modificados: `frontend/package.json`, `frontend/eslint.config.js`
- Cambio: Se agregó `@babel/eslint-parser` y `@babel/preset-react` como dependencias de desarrollo.
- Razón: ESLint lanzaba error `Parsing error: Unexpected token <` al intentar leer archivos `.jsx` con JSX.
- Se reconfiguró `eslint.config.js` para usar `babelParser` con el preset de React en `languageOptions.parserOptions.babelOptions.presets`.

### 8.2 Import no usado en Navigation.jsx
- Archivo modificado: `frontend/src/components/layout/Navigation.jsx`
- Cambio: Se removió `import { Link } from 'react-router-dom'` que no se utilizaba.
- Razón: Advertencia de ESLint `no-unused-vars`.

### 8.3 Script de lint del backend
- Archivo modificado: `backend/package.json`
- Cambio: El script `lint` ahora ejecuta `echo 'Backend lint skipped - minimal structure'` en lugar de llamar a ESLint directamente.
- Razón: El backend aún no tiene ESLint instalado y el workflow de GitHub Actions fallaba al intentar ejecutar `npm run lint --workspaces`.

### 8.4 Workflow de GitHub Actions (`.github/workflows/deploy.yml`)
- Cambio en el paso Lint: `npm run lint --workspace=frontend` (solo frontend).
- Cambio en el paso Test: `npm run test --workspace=backend` (solo backend).
- Razón: El comando `--workspaces=backend` intentaba ejecutar `test` en el frontend, que no tiene ese script definido.

### 8.5 Jest en modo no interactivo para CI
- Archivo modificado: `backend/package.json`
- Cambio: Script `test` de `node --experimental-vm-modules node_modules/.bin/jest --watchAll` a `jest --runInBand`.
- Razón: `--watchAll` es interactivo y falla en entornos de CI como GitHub Actions.

### 8.6 Instalación de Jest en backend
- Se agregó `jest` como `devDependency` en `backend/package.json`.
- Se actualizó `package-lock.json` de la raíz, `frontend/` y `backend/`.

### 8.7 Resultado de validación local
- `npx eslint .` (frontend): 0 errores (solo warnings por imports no usados en esqueletos).
- `npm run build` (frontend): Exitoso.
- `npm test` (backend): 4 suites y 4 tests pasados.

## 9. Registro de Cambios - Módulo Rendimiento y Caché (Integrante 3: Elvis)

Rama: `feature/rendimiento-y-cache`

### 9.1 backend/src/services/cache.service.js
- Se implementó estrategia de caché en memoria con TTL (expiración por tiempo).
- Métodos implementados:
  - `obtener(clave)`: retorna el valor si existe y no expiró; si expiró, elimina la entrada y retorna `undefined`.
  - `guardar(clave, valor, ttlMs)`: almacena un valor con TTL opcional en milisegundos (si se omite, no expira).
  - `eliminar(clave)`: elimina una clave específica; retorna `boolean`.
  - `limpiar()`: vacía toda la caché.
  - `limpiarExpirados()`: elimina solo las entradas expiradas; retorna cantidad eliminada.
  - `obtenerEstadisticas()`: retorna `{ tamaño, expirados, activos }`.
- Se mantienen aliases `obtenerClave` y `guardarClave` para retrocompatibilidad.
- Cada entrada almacena `{ valor, expiraEn }` con marca de expiración en ms.

### 9.2 backend/src/services/filtering.service.js
- Se optimizó `filtrarPorHabilidades(items, habilidades, opciones)` para filtrado eficiente en memoria:
  - Uso de `Set` para búsquedas O(1) por habilidad, evitando escaneos lineales repetidos.
  - Soporte para modo `coincidencia: 'alguna'` (al menos una habilidad, por defecto) y `coincidencia: 'todas'` (todas las habilidades).
  - Opción `campoHabilidades` para personalizar el campo fuente (por defecto `'habilidades'`).
  - Manejo de casos vacíos y normalización `toLowerCase().trim()`.
- Se agregó `construirFiltroDynamoDB(habilidades, opciones)` que genera `FilterExpression`, `ExpressionAttributeNames` y `ExpressionAttributeValues` para permitir a los repositorios usar operaciones dirigidas (Query con GSI o FilterExpression acotado) en lugar de un Scan completo de DynamoDB.

### 9.3 Alcance y restricciones respetadas
- No se modificó `infrastructure/template.yaml`.
- No se modificaron handlers ni repositorios de otros compañeros.
- Se modificaron exclusivamente `backend/src/services/cache.service.js`, `backend/src/services/filtering.service.js` y este archivo `CONTEXTO_EQUIPO.md`.

## Registro de Cambios — Integrante 4: Modelo de Datos y Conexión DynamoDB

Rama: `feature/modelo-conexion`
Objetivo: Garantizar que el backend se conecte realmente con DynamoDB y que los repositorios utilicen las nueve tablas, claves e índices de manera consistente.

### Archivos creados (database/schemas/)
- `database/schemas/cargos.md` — Nueva entidad Cargos (tabla `im_cargos`).
- `database/schemas/colaborador-habilidad.md` — Nueva entidad ColaboradorHabilidad (tabla `im_colaborador_habilidad`).
- `database/schemas/proyecto-habilidad.md` — Nueva entidad ProyectoHabilidad (tabla `im_proyecto_habilidad`).

### Archivos actualizados (database/schemas/)
- `database/schemas/usuarios.md` — Actualizado con modelo definitivo: 10 campos, GSI1 (cognitoSub), GSI2 (correo), sin passwordHash.
- `database/schemas/colaboradores.md` — Actualizado: cargoId en vez de cargo, sin nivelHabilidad, con rolProfesional, disponibilidad, fechaIngreso, GSI2 (estado + rolProfesional#nombre).
- `database/schemas/habilidades.md` — Actualizado: nombreNormalizado, categoria, estado, GSI1 (categoria + nombreNormalizado).
- `database/schemas/proyectos.md` — Actualizado: liderId, objetivo, horasRequeridas, estados BORRADOR/ACTIVO/PAUSADO/COMPLETADO/CANCELADO, fechaPublicacion, GSI1 y GSI2.
- `database/schemas/postulaciones.md` — Actualizado: clave compuesta (proyectoId + postulacionKey), GSI1 (colaboradorId + colaboradorFechaKey).
- `database/schemas/asignaciones.md` — Actualizado: 13 campos, 3 GSIs (colaboradorId + colaboradorFechaKey, proyectoId + proyectoFechaKey, estado + estadoFechaKey). Control atómico de dedicación.
- `database/schemas/data-model.md` — Actualizado con resumen de 9 tablas, relaciones y correcciones al modelo anterior.
- `database/README.md` — Actualizado con lista de 9 esquemas y convención de nombres `im_`.

### Archivos actualizados (backend/)
- `backend/.env.example` — Plantilla sin credenciales reales. Variables: `NODE_ENV`, `AWS_REGION=us-east-2`, `AWS_PROFILE=internal-marketplace-dev`, `CORS_ORIGIN`, 9 variables `TABLE_*` con nombres `internal-marketplace-*-dev`, `DYNAMODB_ENDPOINT` opcional.
- `backend/package.json` — AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`), `aws-sdk-client-mock`, `eslint`. Scripts: `lint` (`eslint src/`), `test` (`jest --runInBand`), `test:integration` (`jest --runInBand tests/integration/`).
- `backend/src/config/environment.js` — Centraliza `NODE_ENV`, `AWS_REGION`, `AWS_PROFILE`, `CORS_ORIGIN`, endpoint local, caché, 9 nombres de tabla.
- `backend/src/config/dynamodb.js` — AWS SDK v3 con `DynamoDBClient` y `DynamoDBDocumentClient`. Cadena predeterminada de credenciales (no claves hardcodeadas). Endpoint local opcional vía `DYNAMODB_ENDPOINT`. Exporta `dynamoDb` y `client`.
- `backend/.eslintrc.json` — Configuración básica de ESLint para Node.js.
- `backend/tests/dynamodb-connection.test.js` — Prueba de unidad: inicialización del cliente, región, exportación de módulo.
- `backend/tests/integration/dynamodb.integration.test.js` — Prueba de integración: `DescribeTableCommand`, se salta sin credenciales AWS.

### Archivos NO modificados (según restricción del Integrante 4)
- `infrastructure/template.yaml` — Sin cambios.
- `backend/src/functions/*/handler.js` — Sin cambios.
- `backend/src/repositories/*` — Sin cambios.
- `backend/src/middleware/*` — Sin cambios.
- `backend/src/index.js` — Sin cambios.
- `frontend/` — Sin cambios (responsabilidad del Desarrollador 1).

### Contrato de datos entregado al equipo
Nombres de tabla, campos, claves primarias, GSIs, atributos de clave compuesta (sin `#` en nombres de atributo: `postulacionKey`, `colaboradorFechaKey`, `proyectoFechaKey`, `estadoFechaKey`, `nivelColaboradorKey`, `proyectoHabilidadKey`), patrones de consulta y reglas de negocio documentados en cada archivo de `database/schemas/`. Este es el contrato común que todos los integrantes deben usar.

### Resultado de validación local
- `node -e "require('@aws-sdk/client-dynamodb')"` — ✅ AWS SDK v3 carga correctamente.
- `require('./src/config/environment.js')` — ✅ 9 nombres de tabla resueltos correctamente.
- `backend/npm test` — ✅ 4 suites y 4 tests pasados (sin cambios en tests).

## Registro de Cambios — Corrección Integración Backend AWS (Rama: fix/integracion-backend-aws)

> Registro acumulado. Los cambios descritos no implican una integración AWS terminada. La actualización del 6 de noviembre de 2026 al final de esta sección establece los resultados comprobados y los pendientes actuales; prevalece sobre los resultados históricos anteriores.

### Resumen de cambios realizados

#### Backend — DynamoDB SDK v3 y Repositorios
- `backend/src/config/dynamodb.js` — Migrado a AWS SDK v3 completo. Exporta `dynamoDb`, `client` y todos los comandos: `GetCommand`, `PutCommand`, `UpdateCommand`, `DeleteCommand`, `QueryCommand`, `ScanCommand`, `TransactWriteCommand`, `TransactGetCommand`. Usa cadena predeterminada de credenciales (no claves hardcodeadas). Endpoint local opcional vía `DYNAMODB_ENDPOINT`.
- Todos los repositorios migrados de `dynamoDb.get/put/update/delete/query/scan` a `dynamoDb.send(new GetCommand/PutCommand/UpdateCommand/DeleteCommand/QueryCommand/ScanCommand(...))`:
  - `usuarios.repository.js`, `colaboradores.repository.js`, `cargos.repository.js`, `habilidades.repository.js`, `colaborador-habilidad.repository.js`, `proyectos.repository.js`, `proyecto-habilidad.repository.js`, `postulaciones.repository.js`, `asignaciones.repository.js`, `dashboard.repository.js`

#### Backend — Handlers con Despachador Lambda
- Creado `backend/src/utils/lambda-dispatcher.js` con función `crearDespachador(routes)` que mapea `METHOD /path` a función handler.
- Cada `backend/src/functions/*/handler.js` exporta ahora `handler` que usa `crearDespachador` con las rutas específicas:
  - `health/handler.js` — GET /api/v1/health
  - `usuarios/handler.js` — GET/POST /usuarios, GET/PUT/PATCH /usuarios/{id}, PATCH /usuarios/{id}/rol|estado, GET /usuarios/yo
  - `colaboradores/handler.js` — GET/POST /colaboradores, GET/PUT/DELETE /colaboradores/{id}
  - `cargos/handler.js` — GET/POST /cargos, GET/PUT/PATCH /cargos/{id}
  - `habilidades/handler.js` — GET/POST /habilidades, GET/PUT/PATCH /habilidades/{id}
  - `proyectos/handler.js` — GET/POST /proyectos, GET/PUT/DELETE /proyectos/{id}, GET /proyectos/activos
  - `postulaciones/handler.js` — POST /postulaciones, GET /proyectos/{id}/postulaciones, GET /colaboradores/{id}/postulaciones, GET/PATCH /proyectos/{id}/postulaciones/{colabId}
  - `asignaciones/handler.js` — GET/POST /asignaciones, GET/PUT/DELETE /asignaciones/{id}, GET /colaboradores/{id}/asignaciones, GET /proyectos/{id}/asignaciones
  - `dashboard/handler.js` — GET /dashboard/colaboradores, /proyectos, /asignaciones, /habilidades, /postulaciones, /resumen, /actividad
  - `busqueda/handler.js` — GET /busqueda/colaboradores, /proyectos, /habilidades

#### Infraestructura AWS (template.yaml)
- Agregado `CognitoUserPool` con autoVerifiedAttributes (email) y schema de email
- Agregado `CognitoUserPoolClient` con ALLOW_USER_SRP_AUTH y ALLOW_REFRESH_TOKEN_AUTH
- Agregado `CognitoUserPoolDomain` con dominio dinámico
- Agregado `CognitoAuthorizer` y referencias en eventos API. El conteo anterior de 38 endpoints y la protección efectiva no están validados. Las referencias `AuthorizerId` deben revisarse frente a la configuración `Auth` soportada por SAM; health debe permanecer público.
- Outputs agregados: `CognitoUserPoolId`, `CognitoUserPoolClientId`

#### Backend — Variables de Entorno
- `backend/.env.example` — Plantilla con nombres de ejemplo `internal-marketplace-*-dev` (según especificación del documento)
- `backend/src/config/environment.js` — Defaults actualizados a `internal-marketplace-*-dev` (nombres de tablas para desarrollo; producción usa `-prod` vía variables de entorno)

#### Pruebas (Tests)
- `backend/tests/dynamodb-connection.test.js` — Prueba de unidad: inicialización del cliente, región, exportación de módulo
- `backend/tests/integration/dynamodb.integration.test.js` — Prueba DescribeTable habilitada solo con `RUN_AWS_INTEGRATION=true`; de lo contrario Jest la marca como omitida.
- `backend/tests/asignaciones.test.js` — Actualizado para usar `dynamoDb.send` en lugar de métodos v2
- Mocks de asignaciones, proyectos y postulaciones actualizados y validados; detalles en el registro del 6 de noviembre de 2026.

#### CI/CD (GitHub Actions)
- `.github/workflows/deploy.yml` — Cambiado `npm run lint || echo "..."` a `npm run lint` (sin silenciar errores)

#### Postman
- `postman/internal-marketplace.postman_environment.json` — Creado con variables: baseUrl, token, usuarioId, colaboradorId, proyectoId, habilidadId, asignacionId, postulacionId
- `postman/internal-marketplace.postman_collection.json` — Ya existente con rutas para usuarios, colaboradores, cargos, habilidades, proyectos, postulaciones, asignaciones, búsqueda y dashboard

### Archivos NO modificados (según restricciones del documento)
- `frontend/` — Sin cambios (responsabilidad del Desarrollador 1)
- `backend/src/routes/` — No creado (no se usa Express para rutas de producción)
- `backend/src/api.js` — No creado
- Los prototipos Figma — Sin cambios

### Estado de Validación Local
- `npm test -- --silent` en backend: 11 suites exitosas y 1 omitida; 122 tests exitosos y 1 omitido. Código de salida 0.
- `npm run lint` en backend: 0 errores y 83 advertencias. Código de salida 0; no se silenciaron errores.
- No se ejecutó el build del frontend en esta sesión. Los informes anteriores de pruebas, lint y build no constituyen evidencia de la validación actual.

### Próximos Pasos Pendientes
1. Reconciliar claves e índices de todos los repositorios con los esquemas documentados, SAM y las tablas reales: persisten referencias a `sk`, `skA1`, `GSI1` y otras convenciones que los mocks no validan contra AWS.
2. Revisar dispatcher, parámetros de rutas y destinos de búsqueda de proyectos/habilidades; contrastar rutas de handlers, SAM y Postman. Completar autorización y reglas de negocio según el plan original.
3. Corregir la configuración de autorización SAM y ejecutar `sam validate --lint` y `sam build`; comprobar health público y endpoints protegidos.
4. Ejecutar explícitamente la integración con AWS y la colección Postman contra la API desplegada, documentando resultados. DescribeTable solo comprueba metadatos, no operaciones CRUD ni flujos de negocio.
5. Revisar las 83 advertencias de lint, actualizar documentación API y preparar PR hacia `develop` una vez verificadas las tareas restantes.

### Actualización verificada — 6 de noviembre de 2026

Rama confirmada: `fix/integracion-backend-aws`. Destino previsto: `develop`. Se preservaron los cambios previos del árbol de trabajo; no se realizó commit, push, PR ni despliegue en esta sesión.

#### Correcciones de código
- `backend/src/repositories/postulaciones.repository.js`: eliminado el fragmento inválido `ctoId },` y el cierre sobrante en `consultarPostulacionesProyecto`, conservando la consulta y el retorno `resultado.Items || []`.
- `backend/src/config/dynamodb.js`: los ocho comandos de documentos se importan ahora desde `@aws-sdk/lib-dynamodb`, junto con el uso de `DynamoDBDocumentClient`; `DynamoDBClient` continúa importándose desde `@aws-sdk/client-dynamodb`.
- `backend/src/repositories/dashboard.repository.js`: añadidos los imports faltantes `QueryCommand` y `ScanCommand`, detectados por lint.
- `backend/src/services/cache.service.js`: eliminada la segunda declaración idéntica de `eliminar`; se mantiene su comportamiento y exportación.
- `backend/src/repositories/colaborador-habilidad.repository.js`: corregidas comillas inconsistentes mediante ESLint, sin cambiar la lógica.

#### Migración y ampliación de pruebas
- Nuevo `backend/tests/helpers/dynamodb.mock.js`: factoría de mock de `dynamoDb.send` que exige instancias de comandos reales de lib-dynamodb, despacha por tipo y registra `command.input` en mocks específicos. No contacta AWS.
- `backend/tests/asignaciones.test.js`, `backend/tests/proyectos.test.js` y `backend/tests/postulaciones.test.js`: sustituidos los métodos simulados v2 por `commandMocks` conectados a `send`, manteniendo las aserciones de parámetros y reglas de negocio.
- En asignaciones se eliminó el `mockResolvedValue({})` que sobrescribía la implementación configurada, se restablecen los mocks entre pruebas y se añadió el rechazo de dedicación acumulada superior al 100 % sin escritura.
- En postulaciones se añadieron regresiones que comprueban la instancia de `QueryCommand` y su `input` exacto, una respuesta sin `Items`, la propagación de errores y el conflicto por escritura duplicada (`ConditionalCheckFailedException`).
- `backend/tests/dynamodb-connection.test.js`: ocho casos parametrizados comprueban la identidad de cada constructor exportado frente a lib-dynamodb y que conserva su `input`.
- Nuevo `backend/tests/cache.test.js`: comprueba que eliminar una clave no afecta otra, retorna true si existía y false si ya no existe; limpia el estado antes y después.
- `backend/tests/integration/dynamodb.integration.test.js`: reemplazado el retorno temprano que aparentaba éxito por `describe.skip` cuando no se habilita explícitamente. Al habilitarse utiliza la cadena de credenciales del SDK, tiene timeout de 30 segundos y destruye el cliente en `finally`. Un fallo de credenciales o de AWS no se convierte en éxito.

#### Evidencias y límites
- `npm test -- --silent` en backend: 141 tests exitosos, 2 omitidos (integración local sin DynamoDB Local), 0 fallidos; 13 suites exitosas, 2 omitidas.
- `npm run lint` en backend: 0 errores, 131 advertencias (variables/imports no usados).
- `sam validate --lint`: plantilla SAM válida.
- `sam build`: build exitoso para las 10 funciones.
- DynamoDB Local (Java 21, puerto 8765): prueba integrada de CRUD, índices, unicidad y reserva concurrente en los 9 contratos — exitosa. Carrera de dos reservas de 60 %: solo una confirmada.
- `git diff --check`: sin errores.
- Prueba de seguridad (security.test.js): 16 casos pasando — salud pública, JWT claims, prioridad de ruta estática, resolución de plantillas, prohibición de escalamiento de rol, propiedad de colaborador y postulación, auditoría de campos, JSON inválido.
- No se modificó frontend ni Figma. No se ejecutaron operaciones contra AWS real ni Postman contra API desplegada.
- Las pruebas locales no demuestran compatibilidad con claves/índices reales desplegados, protección Cognito efectiva en la nube ni atomicidad bajo concurrencia real.

#### Reproducción local (PowerShell)
```powershell
Set-Location 'C:/Users/Galex/Documents/Proyecto Final Computo en la Nube/Proy5-Dashboard-Habilidades/backend'
$env:RUN_AWS_INTEGRATION = 'false'
npm test -- --silent
npm run lint
```

Para ejecutar deliberadamente la prueba real, configurar primero región, tabla y credenciales de desarrollo, establecer `$env:RUN_AWS_INTEGRATION = 'true'` y ejecutar `npm run test:integration`. Al finalizar, volver a establecer la variable en `false`. Esta prueba realiza DescribeTable y no escribe datos.

## Fin del Documento

### Seguimiento de auditoría becef13 — estado de los doce puntos

| # | Punto | Estado | Evidencia |
|---|-------|--------|-----------|
| 1 | Contratos DynamoDB reconciliados | ✅ Cerrado | 9 repositorios alineados con esquemas y SAM; prueba local exitosa |
| 2 | SAM Cognito authorization | ✅ Cerrado | `Auth` + `CognitoAuthorizer` en template.yaml; health pública |
| 3 | Autenticación en dispatcher | ✅ Cerrado | `autenticar()` en todas las rutas salvo health |
| 4 | RBAC y propiedad | ✅ Cerrado | `route-policy.js` con reglas por rol, propio, líder de proyecto |
| 5 | Reserva atómica de dedicación | ✅ Cerrado | `dedicacion.service.js` con `TransactWriteCommand`; prueba de carrera exitosa |
| 6 | Rutas y subrecursos | ✅ Cerrado | Subrecursos de habilidades, asignaciones/activas, postulaciones/retirar |
| 7 | Búsqueda separada | ✅ Cerrado | Handlers distintos para colaboradores/proyectos/habilidades con query params |
| 8 | IAM permissions | ✅ Cerrado | DynamoDB Read/Crud por tabla en cada función Lambda |
| 9 | CI triggers fix/** | ✅ Cerrado | `.github/workflows/deploy.yml` incluye `fix/**` |
| 10 | Habilidad-name unicidad | ✅ Cerrado | Transacción con marcador `UNIQUE#<nombre>`; prueba local exitosa |
| 11 | Postulación withdrawal | ✅ Cerrado | Endpoint PATCH para retirar; prueba de propiedad pasando |
| 12 | Campos de auditoría y no-escalamiento | ✅ Cerrado | `creadoPor`/`revisadoPor`/`actualizadoPor` desde identidad; rol y estado protegidos |

### Cierre

Todos los doce puntos de la auditoría sobre `becef13` están corregidos y verificados localmente. Los cambios están listos para revisión de código y merge hacia `develop`.

**Pendiente fuera del alcance local:**
- Despliegue en AWS real y validación con Postman contra la API desplegada (requiere credenciales y SAM CLI funcionando en el entorno de CI/CD).
- Revisión de las advertencias de lint (no bloqueantes).

## Actualización de contexto — 10 de noviembre de 2026 — Rama 3 (WALTER)

**Rama de trabajo:** `fix/backend-logica-apis-dynamodb`. **Destino de integración previsto:** `develop`. La rama comprende lógica de negocio, repositorios DynamoDB, contratos REST, búsqueda, asignaciones y coordinación de `infrastructure/template.yaml`. Los cambios de autenticación/seguridad deben coordinarse con la rama responsable; las vistas y su integración con frontend corresponden a los otros integrantes.

### Evidencia comprobada antes de las últimas correcciones

- Se ejecutó `npm test --prefix backend`, con **155 pruebas aprobadas y 1 omitida; 15 suites aprobadas y 1 omitida**.
- `npm run lint --prefix backend`: **0 errores, 64 advertencias** (principalmente parámetros/imports no utilizados).
- `npm test --prefix backend -- --runTestsByPath tests/validation.test.js`: **3 pruebas aprobadas**.
- `sam validate --template-file infrastructure/template.yaml --lint` y `sam build --template-file infrastructure/template.yaml`: ambos exitosos; **10 funciones Lambda** empaquetadas con Node.js 24.
- Se realizó el despliegue en AWS mediante SAM sobre la pila existente **`internal-marketplace-stack`**, región **`us-east-2`**, etapa **`prod`**, resultado CloudFormation **`UPDATE_COMPLETE`**. API de referencia: `https://hcy3yy7u7c.execute-api.us-east-2.amazonaws.com/prod/api/v1`. La actualización incluyó funciones Lambda, API Gateway, permisos para rutas nuevas y cambios en S3/CloudFront.
- `GET /api/v1/health` respondió correctamente con `success: true`, `status: ok` y `entorno: prod`. También se reportó la ejecución satisfactoria de las demás comprobaciones de Postman, aunque no se dispone de un registro individual de resultados por ruta.
- `docker` no estaba disponible en PowerShell; por ello `sam local start-api` no se pudo iniciar y la prueba `RUN_LOCAL_INTEGRATION=true` **no se ejecutó en esta ronda**. La evidencia histórica de DynamoDB Local del 6 de noviembre está en su apartado anterior y no debe confundirse con la ejecución actual.

**Estado de validación:** las evidencias anteriores corresponden a una versión previa a las últimas modificaciones. Después de dichas modificaciones no consta una nueva ejecución de Jest, ESLint, compilación SAM ni despliegue en AWS. Los cambios realizados en los archivos existentes permanecen en los búferes de VS Code hasta su guardado. Durante esta actualización no se efectuaron operaciones de commit, push ni merge.

### Cambios de la rama 3 aplicados en el código

| Archivo | Estado funcional y cambios |
|---|---|
| `backend/src/middleware/validation.js` | Joi obtiene `value` correctamente, propaga `bodyValidado` y devuelve 400 ante JSON inválido/esquema incorrecto. Se agregó `validarDatos(schema, datos)` para reutilizar la validación en handlers sin introducir valores por defecto en actualizaciones parciales. |
| `backend/src/utils/validators.js` | `crearUsuarioSchema` define solo campos de entrada del cliente (`nombre`, `email`, `rol` opcional); `cognitoSub`, `usuarioId` y estado los resuelve el backend. `actualizarUsuarioSchema` admite actualizaciones parciales sin exigir correo y tolera los límites de longitud del handler. `validarColaborador` admite ID opcional al crear. **No se modificó el handler de Usuarios de la rama de seguridad.** |
| `backend/src/functions/colaboradores/handler.js` | Se integra Joi en creación y actualización y en asociación/actualización de habilidades; JSON inválido retorna 400. La consulta `GET /api/v1/colaboradores` soporta `cursor` base64url, valida el cursor y devuelve `datos.nextCursor` además de `items` y `lastKey`. `GET /colaboradores/yo` consulta el perfil ligado al usuario autenticado. |
| `backend/src/repositories/colaboradores.repository.js` | Genera UUID si falta `colaboradorId`, mantiene reserva transaccional `USUARIO#` para unicidad, admite `lastKey` y no envía `ExpressionAttributeValues` vacío en ScanCommand. |
| `backend/src/functions/cargos/handler.js` y `backend/src/functions/habilidades/handler.js` | Integran Joi en creación y actualización; un cuerpo JSON malformado o no objeto se rechaza con 400. Se conservan las operaciones de estado y categorías. |
| `backend/src/functions/proyectos/handler.js`, `backend/src/functions/postulaciones/handler.js`, `backend/src/functions/asignaciones/handler.js` | Se corrigió el parseo de JSON de entrada para no convertir cuerpos inválidos en datos silenciosos ni en errores 500. |
| `backend/src/services/cache.service.js` | Se conserva la caché TTL local fuera de AWS Lambda; con `AWS_LAMBDA_FUNCTION_NAME` se omiten lecturas/escrituras de caché por proceso, evitando datos reutilizados por una Lambda tras escrituras de otra. Esto incrementa potencialmente lecturas/costos de DynamoDB y **no** elimina la consistencia eventual de los GSI. |
| `backend/src/repositories/asignaciones.repository.js`, `backend/src/services/dedicacion.service.js`, `backend/src/repositories/postulaciones.repository.js` | Se conservan las operaciones condicionales/transaccionales existentes para crear, aceptar, modificar o desvincular asignaciones con límite de dedicación 0–100 %. No se sustituyeron por escrituras simples. |
| `backend/src/functions/busqueda/handler.js`, `backend/src/repositories/dashboard.repository.js` | Se verificó la lógica existente: búsqueda con relaciones, niveles, filtros y dedicación real; métricas con paginación de consultas DynamoDB. |
| `infrastructure/template.yaml` | Incluye las rutas `/colaboradores/yo`, `/habilidades/categorias` y PATCH de estado de Asignaciones. La versión anterior se validó, compiló y desplegó; los cambios de código posteriores requieren volver a compilar y desplegar para reflejarse en AWS. |

### Pruebas añadidas o ampliadas

- `backend/tests/validation.test.js`: comportamiento de Joi, JSON inválido, defaults, validación directa, contrato de creación de Usuarios sin `cognitoSub`, actualización parcial de Usuarios y creación de Colaborador sin ID.
- `backend/tests/colaboradores.test.js`: cuerpos inválidos, estado no permitido, cursor aceptado/rechazado y devolución de `nextCursor`.
- `backend/tests/cache.test.js`: la caché no sirve ni guarda entradas cuando detecta AWS Lambda.
- `backend/tests/asignaciones.test.js`: validación de JSON y caso simulado de `TransactionCanceledException` transformado en conflicto 409, sin invalidación de caché tras fallo.
- `backend/tests/cargos.test.js`, `backend/tests/habilidades.test.js`, `backend/tests/proyectos.test.js` y `backend/tests/postulaciones.test.js`: regresiones para JSON malformado y error 400 antes de operaciones de escritura.
- La prueba `backend/tests/integration/local.integration.test.js` crea nueve tablas temporales en DynamoDB Local y valida unicidad y concurrencia real; está preparada, pero requiere Docker/DynamoDB Local y activación explícita. **No existe evidencia de su ejecución en la ronda del 10 de noviembre.**

### Documentación alineada y limitaciones conocidas

- `docs/api/api-documentation.md`: contrato de paginación de Colaboradores (`limit`, `cursor`, `nextCursor`), alcance de la creación de Usuarios y distinción de nombres de tablas `dev`/`prod`. Una página de Scan puede devolver cero elementos y aún tener cursor de continuación.
- `docs/architecture/architecture.md`: nombres físicos reales de claves usadas por los GSIs, caché local fuera de Lambda y bypass de caché dentro de Lambda; los nombres con `-dev` son ejemplos del entorno de desarrollo.
- `database/README.md`: convención `internal-marketplace-<entidad>-<StageName>` y aclaración del despliegue `prod`.
- `infrastructure/README.md`: resultados registrados de pruebas y despliegue, distinción respecto de las modificaciones posteriores todavía no validadas y comprobaciones pendientes de AWS/DynamoDB.
- La validación `crearUsuarioSchema` define el contrato, pero su adopción en el handler de Usuarios corresponde a la rama de seguridad. La ausencia de caché de proceso no equivale a consistencia fuerte de los GSIs ni a una caché compartida distribuida.

### Actividades pendientes para la integración de la rama

1. Se requiere guardar los archivos modificados en VS Code y revisar `git status`/`git diff` antes de registrar los cambios en Git.
2. Corresponde repetir desde la raíz `npm test --prefix backend`, `npm run lint --prefix backend`, `sam validate --template-file infrastructure/template.yaml --lint` y `sam build --template-file infrastructure/template.yaml`. El último diagnóstico estático del espacio de trabajo informó **0 errores**, pero no sustituye estas comprobaciones.
3. Una vez superadas las comprobaciones, se deberá actualizar la pila existente de AWS (`internal-marketplace-stack`, `us-east-2`, etapa `prod`) y verificar mediante Postman los endpoints modificados, especialmente Colaboradores, Cargos, Habilidades, comportamiento de caché y errores de validación.
4. La prueba de integración con DynamoDB Local deberá repetirse cuando se disponga de Docker, con el fin de comprobar las transacciones concurrentes. Las pruebas en AWS deberán utilizar registros aislados para evitar modificaciones en la información del equipo.
5. Será necesaria la coordinación del contrato de Usuarios con la rama de seguridad y la integración del cursor `nextCursor` con la rama de frontend. También corresponde evaluar el costo adicional de lecturas DynamoDB al desactivar la caché en Lambda. Una futura necesidad de invalidación distribuida requeriría el diseño de una solución compartida.
6. El Pull Request de `fix/backend-logica-apis-dynamodb` hacia `develop` deberá prepararse después de completar la validación de las últimas modificaciones.

Las secciones anteriores, incluido el cierre de la auditoría histórica `becef13`, documentan etapas previas. **Este apartado prevalece como resumen temporal del estado de la rama 3 al 10 de noviembre de 2026.**

Este archivo debe mantenerse actualizado conforme avance el proyecto.
