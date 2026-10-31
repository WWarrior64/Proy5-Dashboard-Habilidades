# Arquitectura de la Solución

**Institución:** Universidad Católica de El Salvador  
**Materia:** Cómputo en la nube – Grupo B  
**Docente:** Ing. Herberth Contreras  
**Proyecto:** Dashboard de Gestión de Talento y Habilidades Internas (Internal Marketplace)  
**Entrega:** Avance (Laboratorio 2) – 07 de noviembre de 2026 | Defensa Final – 21 de noviembre de 2026

---

## 1. Descripción general

El sistema es una plataforma web administrativa (Dashboard) orientada a la gestión de capital humano. Permite a las empresas mapear las habilidades del personal técnico para asignarlo a proyectos internos según su disponibilidad. La aplicación sigue una arquitectura cliente-servidor con separación clara de capas:

- **Frontend:** SPA en React + Vite, consumiendo una API REST.
- **Backend:** API en Node.js + Express, lista para desplegarse como funciones serverless (AWS Lambda) o en servidor tradicional (EC2).
- **Base de datos:** Amazon DynamoDB (NoSQL) dentro del AWS Free Tier, o RDS (t2.micro/t3.micro) si se elige la opción IaaS.
- **Infraestructura:** AWS Free Tier con S3 + CloudFront (frontend estático) y API Gateway + Lambda (backend serverless), siguiendo la Opción A recomendada.

---

## 2. Arquitectura seleccionada: Opción A (Serverless)

| Componente | Servicio AWS | Justificación |
|------------|--------------|---------------|
| Frontend (estático) | Amazon S3 + Amazon CloudFront | Hosting estático gratuito y caché en el edge para entrega rápida de assets. |
| API / Backend | Amazon API Gateway + AWS Lambda (Node.js) | Serverless sin costo de servidor siempre encendido; se paga solo por uso dentro del free tier. |
| Base de datos | Amazon DynamoDB | NoSQL escalable, modelo flexible para la matriz de talentos y relaciones N:M. |
| Autenticación | Cognito / JWT propio | Manejo de sesiones y control de acceso por roles. |
| CI/CD | GitHub Actions | Despliegue continuo hacia AWS. |

---

## 3. Separación de capas

El código está organizado en tres carpetas principales para garantizar mantenimiento y escalabilidad:

```
/frontend        → Capa de presentación (React SPA)
/backend         → Capa de lógica de negocio y API (Node.js + Express)
/database        → Esquemas y modelo de datos (DynamoDB / RDS)
```

Además, el backend está dividido por responsabilidades:
- `src/config/` → configuración de entorno y conexión a DynamoDB.
- `src/functions/*/handler.js` → controladores por dominio (colaboradores, proyectos, habilidades, asignaciones, postulaciones, usuarios).
- `src/services/` → lógica de filtrado, caché y autorización.
- `src/repositories/` → acceso a datos por entidad.
- `src/middleware/` → autenticación, autorización y validación.
- `src/utils/` → respuestas, validadores y manejo de errores.

---

## 4. Reparto de roles del equipo (5 integrantes)

| Desarrollador | Rol | Responsabilidades principales |
|---------------|-----|------------------------------|
| Desarrollador 1 | Frontend SPA | Buscador interactivo de perfiles por habilidades (Tech Stack), filtros y asignación gráfica. |
| Desarrollador 2 | Backend Filtering Core | Algoritmo de filtrado y búsqueda de candidatos según coincidencia de habilidades. |
| Desarrollador 3 | Cloud Performance | Estrategia de almacenamiento en caché para acelerar consultas recurrentes. |
| Desarrollador 4 | Database Modeling | Diseño de la matriz de habilidades (relaciones N:M entre Desarrolladores, Habilidades y Proyectos). |
| Desarrollador 5 | CI/CD & Repository Manager | Integración continua (GitHub Actions), control de versiones y convenciones de código. |

---

## 5. Procesos CRUD detallados

### Colaboradores
- **Crear:** Dar de alta desarrollador.
- **Leer:** Listar plantilla con filtros por rol.
- **Actualizar:** Actualizar nivel de habilidad (Junior/Mid/Senior).
- **Eliminar:** Eliminar registro de baja.

### Proyectos Internos
- **Crear:** Registrar requerimiento de proyecto.
- **Leer:** Consultar proyectos activos.
- **Actualizar:** Modificar cantidad de horas requeridas.
- **Eliminar:** Cancelar proyecto.

### Asignaciones
- **Crear:** Vincular colaborador a proyecto con porcentaje de dedicación.
- **Leer:** Consultar asignaciones activas.
- **Actualizar:** Editar horas asignadas.
- **Eliminar:** Desvincular colaborador de proyecto.

---

## 6. Integración en AWS (Free Tier)

- **Amazon CloudFront:** Caché en el Edge para la entrega de assets estáticos del frontend (CSS, JS, imágenes).
- **Amazon DynamoDB / RDS (t2.micro):** Almacenamiento estructurado de la matriz de talentos.
- **Seguridad:** Uso de variables de entorno `.env` (sin claves de AWS expuestas), usuarios IAM no-root para desarrollo, y CORS configurado en la API.
- **Control de gasto:** AWS Budgets con alerta de $0.01 USD para evitar cargos accidentales.

---

## 7. Estructura del repositorio

```
Proy5-Dashboard-Habilidades/
├── frontend/          # React + Vite (SPA)
├── backend/           # Node.js + Express (API)
├── database/          # Esquemas de datos
├── infrastructure/    # Template AWS (SAM / CloudFormation)
├── postman/           # Colección de pruebas API
├── docs/              # Documentación técnica
├── .github/           # CI/CD (GitHub Actions)
├── .gitignore
├── .editorconfig
├── package.json
└── README.md
```

---

## 8. Criterios de evaluación cubiertos

Esta estructura cumple con los requisitos del **Laboratorio 2** y la **Defensa Final**:

- ✅ Separación clara entre capas (`/frontend`, `/backend`).
- ✅ Control de versiones con Git/GitHub, ramas (`main`, `develop`, feature branches).
- ✅ Linters (ESLint) y convenciones de código.
- ✅ `.gitignore` configurado (no se suben `node_modules`, entornos virtuales ni credenciales).
- ✅ Endpoints REST definidos para CRUD.
- ✅ Script de conexión a base de datos (DynamoDB).
- ✅ Colección de Postman con operaciones CRUD probadas.
- ✅ Aprovisionamiento inicial en AWS Free Tier.
- ✅ Variables de entorno y usuarios IAM no-root.