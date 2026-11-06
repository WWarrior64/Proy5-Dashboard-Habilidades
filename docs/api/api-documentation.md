# Documentacion de la API - Internal Marketplace

**Version:** 2.0.0  
**Prefijo base comun:** `/api/v1`  
**Base URL (produccion / API Gateway):** `https://{api-id}.execute-api.us-east-2.amazonaws.com/prod/api/v1`  
**Base URL (SAM Local):** `http://127.0.0.1:3000/api/v1`  
**Arquitectura:** AWS Serverless (API Gateway REST API + AWS Lambda con Node.js 24 + DynamoDB)  
**Formato de datos:** `application/json`

---

## 1. Reglas Generales y Contrato de Integracion

### 1.1 Autenticacion y Autorizacion
- **Proveedor de Identidad:** Amazon Cognito User Pools gestiona el registro, inicio de sesion, contraseñas y renovacion de tokens. La API no expone endpoints propios de inicio de sesion (`/auth/login`).
- **Proteccion de rutas:** Todas las operaciones de negocio (carpetas 01 a 09) requieren el token JWT en la cabecera HTTP:
  `Authorization: Bearer <token_cognito>`
- **Ruta publica:** Unicamente `GET /api/v1/health` no requiere autenticacion.
- **Roles de plataforma soportados:** `ADMINISTRADOR`, `RRHH`, `LIDER_PROYECTO`, `EMPLEADO`.

### 1.2 Formato Estandar de Respuestas Lambda
Todas las respuestas devuelven el esquema estandar compatible con Lambda proxy integration:

#### Respuesta Exitosa (200 OK / 201 Created)
```json
{
  "success": true,
  "datos": {},
  "mensaje": "Operacion exitosa",
  "timestamp": "2026-11-06T00:00:00.000Z"
}
```

#### Respuesta de Error (400, 401, 403, 404, 500)
```json
{
  "success": false,
  "error": {
    "mensaje": "Descripcion detallada del error",
    "codigo": "NOT_FOUND",
    "timestamp": "2026-11-06T00:00:00.000Z"
  }
}
```

---

## 2. Catalogo Oficial de Rutas por Modulo

### 2.1 Modulo 00: Salud (Health)
- **Funcion Lambda:** `HealthFunction` (`src/functions/health/handler.js`)
- **Politicas IAM:** Sin acceso a DynamoDB requerido.

- **GET /api/v1/health**
  - Descripcion: Comprobacion de estado operativo del API y Lambda.
  - Autenticacion: Publica.
  - Codigos HTTP: 200 OK.

---

### 2.2 Modulo 01: Usuarios
- **Funcion Lambda:** `UsuariosFunction` (`src/functions/usuarios/handler.js`)
- **Tabla DynamoDB:** `internal-marketplace-usuarios-dev` (PK: `usuarioId`, GSI1: `cognitoSub`, GSI2: `correo`)

- **GET /api/v1/usuarios/yo**
  - Descripcion: Consultar perfil del usuario autenticado (resuelto via cognitoSub).
  - Roles permitidos: Todos.
- **GET /api/v1/usuarios**
  - Descripcion: Listar usuarios registrados.
  - Roles permitidos: ADMINISTRADOR, RRHH.
- **GET /api/v1/usuarios/{usuarioId}**
  - Descripcion: Consultar usuario por identificador.
  - Roles permitidos: ADMINISTRADOR, RRHH.
- **POST /api/v1/usuarios**
  - Descripcion: Crear registro interno de usuario vinculado a Cognito.
  - Roles permitidos: Todos.
- **PUT /api/v1/usuarios/{usuarioId}**
  - Descripcion: Actualizar datos permitidos del usuario.
  - Roles permitidos: Propio usuario, ADMINISTRADOR.
- **PATCH /api/v1/usuarios/{usuarioId}/rol**
  - Descripcion: Cambiar rol de plataforma.
  - Roles permitidos: ADMINISTRADOR.
- **PATCH /api/v1/usuarios/{usuarioId}/estado**
  - Descripcion: Activar o desactivar cuenta de usuario.
  - Roles permitidos: ADMINISTRADOR.

---

### 2.3 Modulo 02: Colaboradores
- **Funcion Lambda:** `ColaboradoresFunction` (`src/functions/colaboradores/handler.js`)
- **Tablas DynamoDB:** `internal-marketplace-colaboradores-dev`, `internal-marketplace-usuarios-dev`, `internal-marketplace-cargos-dev`, `internal-marketplace-colaborador-habilidad-dev`

- **GET /api/v1/colaboradores**
  - Descripcion: Listar plantilla con filtros (estado, cargo, rol).
- **POST /api/v1/colaboradores**
  - Descripcion: Dar de alta un colaborador. Requiere usuarioId y cargoId activos.
- **GET /api/v1/colaboradores/{colaboradorId}**
  - Descripcion: Consultar detalle de colaborador por PK.
- **PUT /api/v1/colaboradores/{colaboradorId}**
  - Descripcion: Actualizar informacion profesional.
- **PATCH /api/v1/colaboradores/{colaboradorId}/estado**
  - Descripcion: Baja logica de colaborador (cambia estado a INACTIVO).
- **GET /api/v1/colaboradores/{colaboradorId}/habilidades**
  - Descripcion: Consultar habilidades asociadas al colaborador.
- **POST /api/v1/colaboradores/{colaboradorId}/habilidades**
  - Descripcion: Asociar habilidad a colaborador (niveles: JUNIOR, MID, SENIOR).
- **PUT /api/v1/colaboradores/{colaboradorId}/habilidades/{habilidadId}**
  - Descripcion: Modificar nivel de dominio o experiencia en tabla N:M.
- **DELETE /api/v1/colaboradores/{colaboradorId}/habilidades/{habilidadId}**
  - Descripcion: Retirar habilidad del perfil de colaborador.

---

### 2.4 Modulo 03: Cargos
- **Funcion Lambda:** `CargosFunction` (`src/functions/cargos/handler.js`)
- **Tabla DynamoDB:** `internal-marketplace-cargos-dev` (PK: `cargoId`, GSI1: `estado`, `nombre`)

- **GET /api/v1/cargos**
  - Descripcion: Listar cargos activos e inactivos.
- **POST /api/v1/cargos**
  - Descripcion: Crear un cargo nuevo en el catalogo.
- **GET /api/v1/cargos/{cargoId}**
  - Descripcion: Consultar cargo por identificador.
- **PUT /api/v1/cargos/{cargoId}**
  - Descripcion: Actualizar nombre y descripcion de un cargo.
- **PATCH /api/v1/cargos/{cargoId}/estado**
  - Descripcion: Desactivar o reactivar un cargo.

---

### 2.5 Modulo 04: Habilidades
- **Funcion Lambda:** `HabilidadesFunction` (`src/functions/habilidades/handler.js`)
- **Tabla DynamoDB:** `internal-marketplace-habilidades-dev` (PK: `habilidadId`, GSI1: `categoria`, `nombreNormalizado`)

- **GET /api/v1/habilidades**
  - Descripcion: Listar catalogo de habilidades con filtros por categoria.
- **POST /api/v1/habilidades**
  - Descripcion: Crear nueva habilidad (valida nombre normalizado unico).
- **GET /api/v1/habilidades/categorias**
  - Descripcion: Listar categorias disponibles de habilidades.
- **GET /api/v1/habilidades/{habilidadId}**
  - Descripcion: Consultar habilidad por identificador.
- **PUT /api/v1/habilidades/{habilidadId}**
  - Descripcion: Actualizar datos descriptivos de la habilidad.
- **PATCH /api/v1/habilidades/{habilidadId}/estado**
  - Descripcion: Activar o desactivar habilidad del catalogo.

---

### 2.6 Modulo 05: Proyectos
- **Funcion Lambda:** `ProyectosFunction` (`src/functions/proyectos/handler.js`)
- **Tablas DynamoDB:** `internal-marketplace-proyectos-dev`, `internal-marketplace-proyecto-habilidad-dev`, `internal-marketplace-usuarios-dev`, `internal-marketplace-colaboradores-dev`

- **GET /api/v1/proyectos**
  - Descripcion: Listar proyectos por estado o lider.
- **POST /api/v1/proyectos**
  - Descripcion: Registrar requerimiento de proyecto (estado inicial BORRADOR).
- **GET /api/v1/proyectos/{proyectoId}**
  - Descripcion: Consultar proyecto por identificador.
- **PUT /api/v1/proyectos/{proyectoId}**
  - Descripcion: Actualizar alcance, fechas u horas requeridas.
- **PATCH /api/v1/proyectos/{proyectoId}/estado**
  - Descripcion: Cancelar o cambiar estado de proyecto (sin borrado fisico).
- **GET /api/v1/proyectos/{proyectoId}/habilidades**
  - Descripcion: Consultar matriz de habilidades requeridas del proyecto.
- **POST /api/v1/proyectos/{proyectoId}/habilidades**
  - Descripcion: Asociar habilidad requerida (nivel minimo, peso y obligatoriedad).
- **PUT /api/v1/proyectos/{proyectoId}/habilidades/{habilidadId}**
  - Descripcion: Actualizar requerimiento de habilidad para el proyecto.
- **DELETE /api/v1/proyectos/{proyectoId}/habilidades/{habilidadId}**
  - Descripcion: Retirar requerimiento de habilidad del proyecto.

---

### 2.7 Modulo 06: Postulaciones
- **Funcion Lambda:** `PostulacionesFunction` (`src/functions/postulaciones/handler.js`)
- **Tablas DynamoDB:** `internal-marketplace-postulaciones-dev` (PK: `proyectoId`, SK: `POSTULACION#colaboradorId`), `internal-marketplace-proyectos-dev`, `internal-marketplace-asignaciones-dev`

- **POST /api/v1/postulaciones**
  - Descripcion: Registrar postulacion de colaborador a proyecto activo.
- **GET /api/v1/proyectos/{proyectoId}/postulaciones**
  - Descripcion: Listar todas las postulaciones asociadas a un proyecto.
- **GET /api/v1/colaboradores/{colaboradorId}/postulaciones**
  - Descripcion: Listar postulaciones de un colaborador (via GSI1).
- **GET /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}**
  - Descripcion: Consultar detalle de postulacion mediante clave compuesta.
- **PATCH /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}/estado**
  - Descripcion: Aceptar o rechazar postulacion. La aceptacion ejecuta TransactWriteItems para generar la asignacion.

---

### 2.8 Modulo 07: Asignaciones
- **Funcion Lambda:** `AsignacionesFunction` (`src/functions/asignaciones/handler.js`)
- **Tablas DynamoDB:** `internal-marketplace-asignaciones-dev` (PK: `asignacionId`, GSIs por colaborador, proyecto y estado)

- **GET /api/v1/asignaciones**
  - Descripcion: Listado general de asignaciones para control y auditoria.
- **POST /api/v1/asignaciones**
  - Descripcion: Crear asignacion directa comprobando que la dedicacion total no supere el 100%.
- **GET /api/v1/asignaciones/activas**
  - Descripcion: Consultar asignaciones activas (filtro por GSI3).
- **GET /api/v1/asignaciones/{asignacionId}**
  - Descripcion: Consultar asignacion por identificador unico.
- **PUT /api/v1/asignaciones/{asignacionId}**
  - Descripcion: Modificar horas o porcentaje de dedicacion activa.
- **PATCH /api/v1/asignaciones/{asignacionId}/estado**
  - Descripcion: Desvincular colaborador (estado DESVINCULADA y registro de fecha).

---

### 2.9 Modulo 08: Busqueda y Algoritmo de Coincidencia
- **Funcion Lambda:** `BusquedaFunction` (`src/functions/busqueda/handler.js`)
- **Tablas DynamoDB:** `internal-marketplace-colaborador-habilidad-dev`, `internal-marketplace-habilidades-dev`, `internal-marketplace-colaboradores-dev`, `internal-marketplace-cargos-dev`

- **GET /api/v1/busqueda/colaboradores?habilidadId={id}&nivel={nivel}**
  - Descripcion: Algoritmo de coincidencia de candidatos segun matriz de habilidades y disponibilidad.
- **GET /api/v1/busqueda/proyectos?habilidadId={id}**
  - Descripcion: Busqueda de proyectos que demanden una habilidad tecnica especifica.
- **GET /api/v1/busqueda/habilidades?q={termino}**
  - Descripcion: Busqueda en catalogo por texto normalizado.

---

### 2.10 Modulo 09: Dashboard y Metricas
- **Funcion Lambda:** `DashboardFunction` (`src/functions/dashboard/handler.js`)
- **Acceso:** Consultas agregadas sin Scan masivo sobre tablas operativas.

- **GET /api/v1/dashboard/resumen**
  - Descripcion: Metricas consolidadas (colaboradores activos, proyectos por estado, asignaciones).
- **GET /api/v1/dashboard/{tipoMetrica}**
  - Descripcion: Desglose especifico de metricas (`colaboradores`, `proyectos`, `asignaciones`, `habilidades`, `postulaciones`).