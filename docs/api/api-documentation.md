# Documentación de la API — Internal Marketplace

**Versión:** 1.0.0  
**Base URL (desarrollo):** `http://localhost:3000/api`  
**Base URL (producción / API Gateway):** `https://{api-id}.execute-api.{region}.amazonaws.com/prod`  
**Backend local:** `backend/src/index.js` se conserva como servidor Express de desarrollo.  
**Despliegue serverless:** API Gateway + AWS Lambda (Node.js), integración Lambda proxy.

---

## 1. Convención de nombres de funciones Lambda y rutas expuestas

Cada ruta de la API está asociada a una función Lambda independiente. La convención de nombre acordada con el integrante 5 (CI/CD & Repository Manager) es:

```
im-{dominio}-{accion}
```

Donde:
- `im` = prefijo del proyecto (Internal Marketplace).
- `{dominio}` = entidad o área de negocio (usuarios, colaboradores, proyectos, habilidades, asignaciones, postulaciones, auth, health).
- `{accion}` = operación CRUD o de negocio (listar, obtener, crear, actualizar, actualizarParcial, eliminar, login, register, me, logout, refresh, health, responder).

Ejemplos: `im-colaboradores-listar`, `im-proyectos-obtener`, `im-auth-login`, `im-health`.

El mapeo ruta → función Lambda se detalla en la tabla de la sección 6. API Gateway expone cada ruta apuntando a su función Lambda correspondiente.

> Nota: este documento establece el contrato. Los nombres finales de las funciones en `infrastructure/template.yaml` los confirma el integrante 5 sin modificar este archivo.

---

## 2. Contrato que reciben los handlers de Lambda

Todos los handlers de Lambda siguen la misma firma y reciben el contrato estándar de API Gateway (Lambda proxy integration):

```js
async function handler(event, context) {
  // ...
}
```

| Parámetro | Descripción | Contenido relevante |
|-----------|-------------|---------------------|
| `event` | Evento de API Gateway Lambda proxy. | `httpMethod` (método HTTP), `path` (ruta completa), `pathParameters` (parámetros de ruta, ej. `{ id: "123" }`), `queryStringParameters` (query string, ej. `{ rol: "EMPLEADO" }`), `body` (cadena JSON del cuerpo de petición; usar `JSON.parse(event.body)`), `headers` (incluye `Authorization: Bearer <token>`), `requestContext`. |
| `context` | Contexto de ejecución de Lambda. | `functionName`, `functionVersion`, `invokedFunctionArn`, `memoryLimitInMB`, `awsRequestId`, `logGroupName`, `logStreamName`, `getRemainingTimeInMillis()`. |

**Extracción de datos del handler:**

```js
const metodo = event.httpMethod;
const ruta = event.path;
const id = event.pathParameters?.id;              // parámetro de ruta :id
const query = event.queryStringParameters || {};   // query string
const body = event.body ? JSON.parse(event.body) : {}; // cuerpo de la petición
const token = event.headers?.Authorization;        // cabecera de autenticación
```

**Patrón de respuesta (usar `backend/src/utils/responses.js`):**

```js
const { exito, creado, error } = require('../../utils/responses');

// Éxito
return exito({ id: '123', nombre: 'Juan' }, 200);

// Creado
return creado({ id: '123' });

// Error
return error('Usuario no encontrado', 404, 'NOT_FOUND');
```

---

## 3. Formato estándar de respuestas HTTP (Lambda)

Todas las respuestas devuelven un objeto compatible con Lambda proxy integration:

```json
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Content-Type": "application/json"
  },
  "body": "{\"success\":true,\"datos\":{...},\"mensaje\":\"Operación exitosa\",\"timestamp\":\"2026-11-03T...\"}"
}
```

### 3.1 Respuesta exitosa (`exito`)

```json
{
  "success": true,
  "datos": { ... },
  "mensaje": "Operación exitosa",
  "timestamp": "2026-11-03T10:00:00.000Z"
}
```

### 3.2 Respuesta de error (`error`)

```json
{
  "success": false,
  "error": {
    "mensaje": "Descripción del error",
    "codigo": "VALIDATION_ERROR",
    "timestamp": "2026-11-03T10:00:00.000Z"
  }
}
```

El campo `error.codigo` es opcional y solo se incluye cuando se proporciona un código de error aplicativo.

---

## 4. Formato de errores y códigos de respuesta

### 4.1 Códigos de estado HTTP

| Código | Significado | Uso típico |
|--------|-------------|------------|
| 200 | OK | Petición exitosa (GET, PUT, PATCH, DELETE). |
| 201 | Created | Recurso creado (POST). |
| 400 | Bad Request | Error de validación en la petición. |
| 401 | Unauthorized | Falta o es inválido el token de autenticación. |
| 403 | Forbidden | El usuario autenticado no tiene permiso para la acción. |
| 404 | Not Found | El recurso solicitado no existe. |
| 409 | Conflicto | El recurso ya existe o hay una inconsistencia (ej. email duplicado). |
| 500 | Internal Server Error | Error inesperado del servidor. |

### 4.2 Códigos de error aplicativo (`error.codigo`)

| Código | Significado | HTTP |
|--------|-------------|------|
| `VALIDATION_ERROR` | Error de validación de entrada | 400 |
| `NOT_FOUND` | Recurso no encontrado | 404 |
| `UNAUTHORIZED` | Autenticación requerida o token inválido | 401 |
| `FORBIDDEN` | Acceso denegado por rol/permiso | 403 |
| `CONFLICT` | Conflicto de recurso (duplicado, etc.) | 409 |
| `INTERNAL_SERVER_ERROR` | Error interno del servidor | 500 |

Clase `ErrorApp` (`backend/src/utils/errors.js`): permite lanzar errores con `codigo` (HTTP) y `codigoError` (aplicativo).

```js
const { ErrorApp } = require('../../utils/errors');
throw new ErrorApp('Colaborador no encontrado', 404, 'NOT_FOUND');
```

---

## 5. Autenticación

Las peticiones protegidas requieren el header:

```
Authorization: Bearer <token_jwt>
```

| Endpoint | Público | Descripción |
|----------|---------|-------------|
| POST /auth/login | ✅ | Iniciar sesión (devuelve token). |
| POST /auth/register | ✅ | Registrar nuevo usuario. |
| GET /auth/me | ❌ | Usuario autenticado actual (requiere token). |
| POST /auth/logout | ❌ | Cerrar sesión (requiere token). |

### Asignaciones (6 rutas)

| # | Método | Endpoint | Descripción | Función Lambda | Auth |
|---|--------|----------|-------------|----------------|------|
| 25 | GET | /asignaciones | Listar asignaciones | `im-asignaciones-listar` | ✅ |
| 26 | GET | /asignaciones/:id | Obtener asignación por ID | `im-asignaciones-obtener` | ✅ |
| 27 | POST | /asignaciones | Crear asignación | `im-asignaciones-crear` | ✅ |
| 28 | PUT | /asignaciones/:id | Actualizar asignación | `im-asignaciones-actualizar` | ✅ |
| 29 | PATCH | /asignaciones/:id | Actualizar parcialmente asignación | `im-asignaciones-actualizarParcial` | ✅ |
| 30 | DELETE | /asignaciones/:id | Eliminar asignación | `im-asignaciones-eliminar` | ✅ |

### Postulaciones (6 rutas)

| # | Método | Endpoint | Descripción | Función Lambda | Auth |
|---|--------|----------|-------------|----------------|------|
| 31 | GET | /postulaciones | Listar postulaciones | `im-postulaciones-listar` | ✅ |
| 32 | GET | /postulaciones/:id | Obtener postulación por ID | `im-postulaciones-obtener` | ✅ |
| 33 | POST | /postulaciones | Crear postulación | `im-postulaciones-crear` | ✅ |
| 34 | PUT | /postulaciones/:id | Actualizar postulación | `im-postulaciones-actualizar` | ✅ |
| 35 | PATCH | /postulaciones/:id | Actualizar parcialmente postulación | `im-postulaciones-actualizarParcial` | ✅ |
| 36 | DELETE | /postulaciones/:id | Eliminar postulación | `im-postulaciones-eliminar` | ✅ |

### Autenticación (5 rutas)

| # | Método | Endpoint | Descripción | Función Lambda | Auth |
|---|--------|----------|-------------|----------------|------|
| 37 | POST | /auth/login | Iniciar sesión | `im-auth-login` | ❌ |
| 38 | POST | /auth/register | Registrar usuario | `im-auth-register` | ❌ |
| 39 | GET | /auth/me | Usuario autenticado actual | `im-auth-me` | ✅ |
| 40 | POST | /auth/logout | Cerrar sesión | `im-auth-logout` | ✅ |
| 41 | POST | /auth/refresh | Renovar token de acceso | `im-auth-refresh` | ✅ |

### Salud (1 ruta)

| # | Método | Endpoint | Descripción | Función Lambda | Auth |
|---|--------|----------|-------------|----------------|------|
| 42 | GET | /health | Comprobación de funcionamiento | `im-health` | ❌ |

### Rutas de negocio adicionales (14 rutas)

| # | Método | Endpoint | Descripción | Función Lambda | Auth |
|---|--------|----------|-------------|----------------|------|
| 43 | PATCH | /postulaciones/:id/responder | Responder postulación (aceptar/rechazar) | `im-postulaciones-responder` | ✅ |
| 44 | GET | /colaboradores/:id/habilidades | Habilidades de un colaborador | `im-colaboradores-habilidades` | ✅ |
| 45 | POST | /colaboradores/:id/habilidades | Asignar habilidad a un colaborador | `im-colaboradores-habilidades-agregar` | ✅ |
| 46 | DELETE | /colaboradores/:id/habilidades/:habilidadId | Remover habilidad de un colaborador | `im-colaboradores-habilidades-remover` | ✅ |
| 47 | GET | /proyectos/:id/habilidades | Habilidades requeridas de un proyecto | `im-proyectos-habilidades` | ✅ |

---

## 7. Comprobación de funcionamiento (/health)

El endpoint `GET /health` permite verificar que la API (o su función Lambda `im-health`) está operativa. No requiere autenticación y devuelve:

```json
{
  "success": true,
  "datos": {
    "status": "ok",
    "servicio": "internal-marketplace-api",
    "entorno": "development",
    "timestamp": "2026-11-03T10:00:00.000Z"
  },
  "mensaje": "Operación exitosa",
  "timestamp": "2026-11-03T10:00:00.000Z"
}
```

En el servidor Express de desarrollo local (`backend/src/index.js`) la ruta `/health` ya está expuesta. En producción, API Gateway la enruta a la función Lambda `im-health`.

---

## 8. Ejemplos de cuerpo de petición y respuesta

### Crear colaborador (POST /colaboradores)

**Petición:**
```json
{
  "nombre": "Juan Pérez",
  "rol": "EMPLEADO",
  "nivelHabilidad": "Mid",
  "cargo": "Desarrollador",
  "activo": true
}
```

**Respuesta (201):**
```json
{
  "success": true,
  "datos": { "colaboradorId": "uuid-...", "nombre": "Juan Pérez", ... },
  "mensaje": "Operación exitosa",
  "timestamp": "2026-11-03T10:00:00.000Z"
}
```

### Error de validación (400)

```json
{
  "success": false,
  "error": {
    "mensaje": "El campo email es obligatorio",
    "codigo": "VALIDATION_ERROR",
    "timestamp": "2026-11-03T10:00:00.000Z"
  }
}
```

---

## 9. Pruebas

Se incluye una colección de Postman en `postman/internal-marketplace.postman_collection.json` con operaciones CRUD probadas. Se recomienda agregar pruebas para las 56 rutas documentadas en esta versión.

---

## 10. Archivos relacionados del integrante 1 (API REST y Lambda)

| Archivo | Propósito |
|---------|-----------|
| `docs/api/api-documentation.md` | Contrato de la API: 56 rutas, formato de respuesta, errores, contrato de handlers, convención Lambda. |
| `backend/src/utils/responses.js` | Funciones `exito`, `creado`, `error` con formato estándar Lambda `{statusCode, headers, body}`. |
| `backend/src/utils/errors.js` | Clase `ErrorApp` y catálogo `CODIGOS` de errores aplicativo y HTTP. |
| `backend/src/functions/health/handler.js` | Handler Lambda de `/health` (comprobación de funcionamiento). |

> No se modificó: `infrastructure/template.yaml`, repositorios ni handlers CRUD de otros integrantes. `backend/src/index.js` se conserva como servidor Express de desarrollo local.
| 48 | POST | /proyectos/:id/habilidades | Agregar habilidad requerida a un proyecto | `im-proyectos-habilidades-agregar` | ✅ |
| 49 | DELETE | /proyectos/:id/habilidades/:habilidadId | Remover habilidad requerida de un proyecto | `im-proyectos-habilidades-remover` | ✅ |
| 50 | GET | /asignaciones/activas | Asignaciones activas | `im-asignaciones-activas` | ✅ |
| 51 | GET | /postulaciones/pendientes | Postulaciones pendientes | `im-postulaciones-pendientes` | ✅ |
| 52 | GET | /dashboard/estadisticas | Estadísticas del dashboard | `im-dashboard-estadisticas` | ✅ |
| 53 | GET | /dashboard/actividad | Actividad reciente | `im-dashboard-actividad` | ✅ |
| 54 | GET | /colaboradores/activos | Colaboradores activos | `im-colaboradores-activos` | ✅ |
| 55 | GET | /proyectos/activos | Proyectos activos | `im-proyectos-activos` | ✅ |
| 56 | GET | /habilidades/categorias | Categorías de habilidades disponibles | `im-habilidades-categorias` | ✅ |

**Total: 56 rutas.**
| POST /auth/refresh | ❌ | Renovar token de acceso (requiere token). |
| GET /health | ✅ | Comprobación de funcionamiento (sin autenticación). |
| Rutas CRUD de entidades | ❌ | Requieren autenticación y autorización por rol. |

Roles soportados: `ADMINISTRADOR`, `LIDER_PROYECTO`, `RECURSOS_HUMANOS`, `EMPLEADO`.

---

## 6. Rutas de la API (56 rutas)

A continuación el catálogo completo de rutas, métodos, descripción, función Lambda asociada y si requieren autenticación.

### Usuarios (6 rutas)

| # | Método | Endpoint | Descripción | Función Lambda | Auth |
|---|--------|----------|-------------|----------------|------|
| 1 | GET | /usuarios | Listar usuarios | `im-usuarios-listar` | ✅ |
| 2 | GET | /usuarios/:id | Obtener usuario por ID | `im-usuarios-obtener` | ✅ |
| 3 | POST | /usuarios | Crear usuario | `im-usuarios-crear` | ✅ |
| 4 | PUT | /usuarios/:id | Actualizar usuario | `im-usuarios-actualizar` | ✅ |
| 5 | PATCH | /usuarios/:id | Actualizar parcialmente usuario | `im-usuarios-actualizarParcial` | ✅ |
| 6 | DELETE | /usuarios/:id | Eliminar usuario | `im-usuarios-eliminar` | ✅ |

### Colaboradores (6 rutas)

| # | Método | Endpoint | Descripción | Función Lambda | Auth |
|---|--------|----------|-------------|----------------|------|
| 7 | GET | /colaboradores | Listar colaboradores | `im-colaboradores-listar` | ✅ |
| 8 | GET | /colaboradores/:id | Obtener colaborador por ID | `im-colaboradores-obtener` | ✅ |
| 9 | POST | /colaboradores | Crear colaborador | `im-colaboradores-crear` | ✅ |
| 10 | PUT | /colaboradores/:id | Actualizar colaborador | `im-colaboradores-actualizar` | ✅ |
| 11 | PATCH | /colaboradores/:id | Actualizar parcialmente colaborador | `im-colaboradores-actualizarParcial` | ✅ |
| 12 | DELETE | /colaboradores/:id | Eliminar colaborador | `im-colaboradores-eliminar` | ✅ |

### Proyectos (6 rutas)

| # | Método | Endpoint | Descripción | Función Lambda | Auth |
|---|--------|----------|-------------|----------------|------|
| 13 | GET | /proyectos | Listar proyectos | `im-proyectos-listar` | ✅ |
| 14 | GET | /proyectos/:id | Obtener proyecto por ID | `im-proyectos-obtener` | ✅ |
| 15 | POST | /proyectos | Crear proyecto | `im-proyectos-crear` | ✅ |
| 16 | PUT | /proyectos/:id | Actualizar proyecto | `im-proyectos-actualizar` | ✅ |
| 17 | PATCH | /proyectos/:id | Actualizar parcialmente proyecto | `im-proyectos-actualizarParcial` | ✅ |
| 18 | DELETE | /proyectos/:id | Eliminar (cancelar) proyecto | `im-proyectos-eliminar` | ✅ |

### Habilidades (6 rutas)

| # | Método | Endpoint | Descripción | Función Lambda | Auth |
|---|--------|----------|-------------|----------------|------|
| 19 | GET | /habilidades | Listar habilidades | `im-habilidades-listar` | ✅ |
| 20 | GET | /habilidades/:id | Obtener habilidad por ID | `im-habilidades-obtener` | ✅ |
| 21 | POST | /habilidades | Crear habilidad | `im-habilidades-crear` | ✅ |
| 22 | PUT | /habilidades/:id | Actualizar habilidad | `im-habilidades-actualizar` | ✅ |
| 23 | PATCH | /habilidades/:id | Actualizar parcialmente habilidad | `im-habilidades-actualizarParcial` | ✅ |
| 24 | DELETE | /habilidades/:id | Eliminar habilidad | `im-habilidades-eliminar` | ✅ |