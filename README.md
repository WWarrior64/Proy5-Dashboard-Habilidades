# Internal Marketplace — Plataforma de Gestión de Talento y Habilidades

Sistema Serverless empresarial desarrollado para optimizar la asignación de colaboradores a proyectos internos según sus perfiles profesionales, catálogo de competencias técnicas y disponibilidad de tiempo.

Proyecto desarrollado para la cátedra de Cómputo en la Nube (Grupo B) de la Universidad Católica de El Salvador (UNICAES), ciclo II-2026.

## 1. Arquitectura de la Solución

La plataforma sigue una arquitectura desacoplada y orientada a eventos sobre AWS Serverless:

* Frontend: Single Page Application (SPA) en React 18 + Vite, alojada en un bucket privado de Amazon S3 y distribuida globalmente con Amazon CloudFront mediante Origin Access Control (OAC).
* Backend: 10 funciones modulares en AWS Lambda ejecutadas sobre el runtime oficial nodejs24.x.
* API Gateway: REST API modular con prefijo unificado /api/v1 y soporte CORS global habilitado.
* Base de Datos NoSQL: 9 tablas en Amazon DynamoDB con modo de facturación PAY_PER_REQUEST y diseño de índices secundarios globales (GSI).
* Identidad y Seguridad: Autenticación y gestión de sesiones delegada en Amazon Cognito User Pools (validación mediante tokens JWT).
* Infraestructura como Código (IaC): Orquestada mediante AWS SAM (infrastructure/template.yaml).
* CI/CD: Pipeline automatizado en GitHub Actions (.github/workflows/deploy.yml) para validación de linter, suites de prueba y verificación de build SAM.

## 2. Estructura del Repositorio

* .github/workflows/deploy.yml — Pipeline de integración continua (CI)
* backend/eslint.config.js — Reglas de estilo ESLint 9 (Flat Config)
* backend/src/config/ — Conexión a DynamoDB v3 y entorno
* backend/src/functions/ — Handlers Lambda modulares (10 dominios)
* backend/src/repositories/ — Capa de acceso a datos DynamoDB
* backend/src/services/ — Lógica de negocio, caché y filtrado
* backend/src/utils/ — Formateadores de respuesta y errores
* backend/tests/ — Pruebas unitarias en Jest
* docs/api/api-documentation.md — Contrato oficial de rutas y respuestas v1
* docs/architecture/architecture.md — Diagramas y decisiones de diseño AWS
* docs/database/database-design.md — Diseño lógico y físico de tablas DynamoDB
* frontend/src/ — Código fuente SPA React + Vite
* frontend/vite.config.js — Configuración de empaquetado
* infrastructure/template.yaml — Plantilla AWS SAM de infraestructura
* postman/internal-marketplace.postman_collection.json — 10 módulos funcionales
* postman/internal-marketplace.postman_environment.json — Variables de entorno
* postman/README.md — Guía de importación y uso
* CONTEXTO_EQUIPO.md — Bitácora histórica y acuerdos técnicos
* README.md — Guía general de inicio y ejecución

## 3. Requisitos Previos

* Node.js: Versión 24.x LTS (compatible con el runtime de Lambda).
* npm: Versión 10.x o superior.
* AWS CLI: Configurado con credenciales de desarrollo (aws configure).
* AWS SAM CLI: Instalado para validación y pruebas locales (sam --version).
* Postman: Para ejecución de la colección de pruebas de integración.

## 4. Configuración y Ejecución Local

### 4.1 Instalación de Dependencias

Desde la raíz del repositorio, instala las dependencias de todas las áreas de trabajo:

```bash
npm ci
cd backend && npm ci
cd ../frontend && npm ci
cd ..
```

### 4.2 Variables de Entorno

1. En la carpeta backend/, copia el archivo de ejemplo:

```bash
cp backend/.env.example backend/.env
```

2. Completa los nombres de tabla estandarizados con el prefijo TABLE_:

```env
NODE_ENV=dev
PORT=3000
AWS_REGION=us-east-2
TABLE_USUARIOS=internal-marketplace-usuarios-dev
TABLE_COLABORADORES=internal-marketplace-colaboradores-dev
TABLE_CARGOS=internal-marketplace-cargos-dev
TABLE_HABILIDADES=internal-marketplace-habilidades-dev
TABLE_COLABORADOR_HABILIDAD=internal-marketplace-colaborador-habilidad-dev
TABLE_PROYECTOS=internal-marketplace-proyectos-dev
TABLE_PROYECTO_HABILIDAD=internal-marketplace-proyecto-habilidad-dev
TABLE_POSTULACIONES=internal-marketplace-postulaciones-dev
TABLE_ASIGNACIONES=internal-marketplace-asignaciones-dev
```

### 4.3 Validación y Emulación Local con AWS SAM

1. Validar la plantilla SAM:

```bash
sam validate --lint --template-file infrastructure/template.yaml
```

2. Compilar las funciones:

```bash
sam build --template-file infrastructure/template.yaml
```

3. Iniciar API Gateway en local:

```bash
sam local start-api --port 3000
```

La API quedará escuchando en `http://127.0.0.1:3000/api/v1`.

### 4.4 Ejecución del Frontend

```bash
cd frontend
npm run dev
```

Accede en tu navegador a `http://localhost:5173`.

## 5. Pruebas y Control de Calidad

* Linter del Backend:

```bash
cd backend && npm run lint
```

* Pruebas Unitarias del Backend:

```bash
cd backend && npm test -- --runInBand
```

* Compilación de Producción del Frontend:

```bash
cd frontend && npm run build
```

* Pruebas de API con Postman: Importa los archivos ubicados en `postman/` siguiendo las instrucciones de `postman/README.md`.

## 6. Equipo de Desarrollo y Roles

* Desarrollador 1: Arquitectura Base y Contrato API (Handlers base y utilidades de respuesta).
* Desarrollador 2: Servicios Core del Backend (Usuarios, Colaboradores, Cargos, Habilidades y Búsqueda).
* Desarrollador 3: Servicios de Asignación y Métricas (Proyectos, Postulaciones, Asignaciones y Dashboard).
* Desarrollador 4: Modelado de Datos NoSQL (Esquema de 9 tablas DynamoDB y diseño de índices GSIs).
* Diego Ernesto Portillo Alfaro (Desarrollador 5): Infraestructura, CI/CD y Calidad (Plantilla AWS SAM con 10 Lambdas Node 24, ESLint 9, GitHub Actions, Postman y Documentación).