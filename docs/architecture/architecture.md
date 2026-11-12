# Arquitectura del Sistema — Internal Marketplace

**Versión:** 2.0.0  
---

## 1. Visión General de la Arquitectura

La plataforma **Internal Marketplace** implementa un modelo 100% Serverless desacoplado en Amazon Web Services (AWS), garantizando alta disponibilidad, escalabilidad automática y cero mantenimiento de servidores dedicados.

### Flujo de Datos End-to-End
```text
[ Cliente Web / Navegador ]
            │
            ▼
    ┌───────────────────────────────┐
    │  Amazon CloudFront (CDN)      │ (Distribución global HTTPS con OAC)
    └───────────────┬───────────────┘
                    │
            ┌───────┴───────┐
            ▼               ▼
   [ S3 Private Bucket ]  [ Amazon API Gateway ]
   (React + Vite SPA)     (REST API /api/v1)
                                   │
                                   ├──► [ Amazon Cognito ] (Authorizer / JWT)
                                   │
                                   ▼
                       [ 10 Funciones AWS Lambda ]
                       (Node.js 24 / CommonJS)
                                   │
                                   ├──► [ In-Memory Cache (TTL) ]
                                   │
                                   ▼
                       [ Amazon DynamoDB ]
                       (9 Tablas NoSQL en modo On-Demand)
```

---

## 2. Componentes de la Arquitectura

### 2.1 Frontend Hosting y Distribución (S3 + CloudFront con OAC)
* **Bucket S3 Privado:** Almacena exclusivamente los artefactos estáticos compilados de la aplicación React SPA (`dist/`). Posee bloqueo total de acceso público (`PublicAccessBlockConfiguration`).
* **Origin Access Control (OAC):** Mecanismo de seguridad de última generación que firma criptográficamente las peticiones mediante SigV4, autorizando únicamente a la distribución de CloudFront a leer los objetos de S3 mediante una política de bucket estricta (`s3:GetObject`).
* **CloudFront CDN:** Maneja la terminación SSL/TLS (HTTPS), compresión de archivos y caché perimetral, gestionando los errores 403/404 redirigiéndolos a `index.html` (HTTP 200) para soportar el enrutamiento del lado del cliente (React Router).

### 2.2 Gestión de Identidad y Seguridad (Amazon Cognito)
* **Cognito User Pool:** Proveedor de identidad centralizado que gestiona credenciales de acceso, cifrado de contraseñas, políticas de seguridad y emisión de tokens JWT (`IdToken`, `AccessToken`, `RefreshToken`).
* **Cognito Authorizer en API Gateway:** Intercepta cada solicitud entrante a rutas protegidas (`/api/v1/...`), validando la firma y vigencia del JWT antes de invocar cualquier handler de Lambda.
* **Separación de responsabilidades:** La base de datos DynamoDB no almacena contraseñas ni hashes; únicamente almacena el perfil operativo del usuario correlacionado mediante el identificador único `cognitoSub`.

### 2.3 Capa de API y Cómputo (API Gateway + AWS Lambda)
* **API Gateway REST API:** Expone los recursos bajo el prefijo unificado `/api/v1/`, con soporte nativo de CORS y enrutamiento estructurado hacia funciones Lambda modulares mediante integración Lambda Proxy.
* **AWS Lambda (Node.js 24 LTS):** Arquitectura modular de 10 funciones organizadas por dominio de negocio (evitando dispersión de microfunciones CRUD individuales):
  1. `HealthFunction`: Diagnóstico de salud y uptime (`/health`).
  2. `UsuariosFunction`: Administración de identidades y roles.
  3. `ColaboradoresFunction`: Ficha laboral y asignación de habilidades.
  4. `CargosFunction`: Catálogo de posiciones de la empresa.
  5. `HabilidadesFunction`: Catálogo corporativo de habilidades técnicas y blandas.
  6. `ProyectosFunction`: Ciclo de vida y requerimientos de proyectos.
  7. `PostulacionesFunction`: Solicitudes de participación en proyectos.
  8. `AsignacionesFunction`: Gestión de dedicación y vinculación formal.
  9. `BusquedaFunction`: Motor de coincidencia de perfiles y requerimientos.
  10. `DashboardFunction`: Agregación de indicadores y métricas de plataforma.

### 2.4 Principio de Mínimo Privilegio (IAM Execution Roles)
Cada función Lambda dispone de un rol de ejecución dedicado en IAM que restringe el acceso exclusivamente a las tablas e índices que necesita para operar:
* Las funciones operativas no tienen permisos globales (`dynamodb:*`).
* Se diferencian políticas de solo lectura (`DynamoDBReadPolicy`) de aquellas con capacidad de mutación (`DynamoDBCrudPolicy`).
* Se garantiza acceso explícito a los índices secundarios globales (GSIs).

---

## 3. Modelo de Datos y Persistencia (Amazon DynamoDB)

La persistencia se implementa sobre 9 tablas diseñadas bajo el modelo NoSQL de clave-valor y documentos, configuradas en modo **On-Demand (PAY_PER_REQUEST)** para optimizar costos dentro del Free Tier. Los nombres físicos con `-dev` de la siguiente tabla son ejemplos; el despliegue `prod` usa los mismos nombres con `-prod`:

| Nombre Lógico SAM | Nombre Físico de Tabla | Partition Key (PK) | Sort Key (SK) | Índices Secundarios (GSIs) |
| :--- | :--- | :--- | :--- | :--- |
| `UsuariosTable` | `internal-marketplace-usuarios-dev` | `usuarioId` (S) | *Ninguno* | GSI1 (`cognitoSub`), GSI2 (`correo`) |
| `ColaboradoresTable` | `internal-marketplace-colaboradores-dev` | `colaboradorId` (S) | *Ninguno* | GSI1 (`usuarioId`), GSI2 (`estado`, `rolProfesional#nombre`) |
| `CargosTable` | `internal-marketplace-cargos-dev` | `cargoId` (S) | *Ninguno* | GSI1 (`estado`, `nombre`) |
| `HabilidadesTable` | `internal-marketplace-habilidades-dev` | `habilidadId` (S) | *Ninguno* | GSI1 (`categoria`, `nombreNormalizado`) |
| `ColaboradorHabilidadTable` | `internal-marketplace-colaborador-habilidad-dev` | `colaboradorId` (S) | `habilidadId` (S) | GSI1 (`habilidadId`, `nivelColaboradorKey`) |
| `ProyectosTable` | `internal-marketplace-proyectos-dev` | `proyectoId` (S) | *Ninguno* | GSI1 (`estado`, `fechaPublicacionKey`), GSI2 (`liderId`, `estadoFechaKey`) |
| `ProyectoHabilidadTable` | `internal-marketplace-proyecto-habilidad-dev` | `proyectoId` (S) | `habilidadId` (S) | GSI1 (`habilidadId`, `proyectoId`) |
| `PostulacionesTable` | `internal-marketplace-postulaciones-dev` | `proyectoId` (S) | `postulacionKey` (S; guarda `POSTULACION#colaboradorId`) | GSI1 (`colaboradorId`, `colaboradorFechaKey`) |
| `AsignacionesTable` | `internal-marketplace-asignaciones-dev` | `asignacionId` (S) | *Ninguno* | GSI1 (`colaboradorId`, `colaboradorFechaKey`), GSI2 (`proyectoId`, `proyectoFechaKey`), GSI3 (`estado`, `estadoFechaKey`) |

### Transacciones Atómicas (TransactWriteItems)
Para procesos de negocio críticos (como la aceptación de una postulación que crea una asignación e incrementa el porcentaje de dedicación activa del colaborador), se emplea `TransactWriteItems`. Esto evita condiciones de carrera y asegura consistencia estricta en operaciones compuestas.

---

## 4. Estrategia de Caché y Rendimiento

* **Caché local de desarrollo:** `cache.service.js` conserva claves e intervalos TTL cuando se ejecuta fuera de AWS Lambda, con invalidación local tras las escrituras.
* **Lecturas en Lambda sin caché de proceso:** Cuando existe `AWS_LAMBDA_FUNCTION_NAME`, el servicio no devuelve ni guarda entradas en memoria. Esto evita que una instancia reutilice una lectura obsoleta tras una escritura de otra Lambda. Aumenta las consultas y costos potenciales de DynamoDB, pero no requiere caché distribuida. Los índices secundarios DynamoDB siguen ofreciendo consistencia eventual; esta medida no garantiza lectura fuertemente consistente en GSIs.
* **Decisiones críticas:** La dedicación y sus límites se comprueban mediante condiciones transaccionales contra DynamoDB, nunca utilizando la caché.
* **CloudFront Edge Caching:** Configurado con la directiva optimizada de AWS (`Managed-CachingOptimized`) para servir activos estáticos del frontend desde puntos perimetrales con latencia mínima.

---

## 5. Pipeline de CI/CD (GitHub Actions)

El ciclo de integración continua implementado en `.github/workflows/deploy.yml` valida automáticamente cada entrega:
1. **Entorno de ejecución:** Node.js 24 en runners `ubuntu-latest`.
2. **Control de Calidad:**
   * Ejecución de ESLint del backend y pruebas unitarias Jest.
   * Compilación del frontend; el lint y las pruebas automatizadas React en CI deberán incorporarse al integrar las ramas correspondientes.
3. **Validación de Infraestructura:**
   * `sam validate --lint`: Comprobación de sintaxis y buenas prácticas en `infrastructure/template.yaml`.
   * `sam build`: Compilación y empaquetado de las funciones Lambda y sus dependencias.
4. **Política de Despliegue:** El despliegue automático está deshabilitado por seguridad de costos; los despliegues hacia AWS se realizan de forma controlada mediante `sam deploy` con perfiles IAM no-root.