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