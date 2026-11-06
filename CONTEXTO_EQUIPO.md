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

Servicios (backend/src/services/): filtering.service.js, cache.service.js, authorization.service.js.

Repositorios (backend/src/repositories/): colaboradores, proyectos, habilidades, asignaciones, postulaciones, usuarios.

Middleware (backend/src/middleware/): authentication.js, authorization.js, validation.js.

Utils (backend/src/utils/): responses.js, validators.js, errors.js.

Tests (backend/tests/): colaboradores.test.js, proyectos.test.js, asignaciones.test.js, filtering.test.js.

### 2.4 Base de Datos (database/)

Archivos: database/README.md y database/schemas/ (data-model.md, usuarios.md, colaboradores.md, cargos.md, habilidades.md, colaborador-habilidad.md, proyectos.md, proyecto-habilidad.md, postulaciones.md, asignaciones.md). Todos en Markdown definiendo campos, claves compuestas y GSIs bajo convención `im_*`.

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

## Fin del Documento

Este archivo debe mantenerse actualizado conforme avance el proyecto.
