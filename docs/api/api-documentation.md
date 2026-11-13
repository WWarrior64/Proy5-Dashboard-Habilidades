# Documentacion de la API - Internal Marketplace

**Versión documental:** 2.1.0 (contrato de código vigente; despliegue en AWS pendiente de validación)  
**Prefijo base comun:** `/api/v1`  
**Base URL (produccion / API Gateway):** `https://{api-id}.execute-api.us-east-2.amazonaws.com/prod/api/v1`  
**Base URL (SAM Local):** `http://127.0.0.1:3000/api/v1`  
**Arquitectura:** AWS Serverless (API Gateway REST API + AWS Lambda con Node.js 24 + DynamoDB)  
**Formato de datos:** `application/json`  
**Nombres de tablas en ejemplos:** el sufijo `-dev` corresponde a desarrollo; la plantilla usa `-prod` cuando `StageName=prod`. 

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
  - Descripcion: Consultar perfil del usuario autenticado (resuelto via cognitoSub), sin modificar el último acceso al recargar páginas o restaurar la sesión.
  - Roles permitidos: Todos.
- **POST /api/v1/usuarios/yo/acceso**
  - Descripcion: Registrar en DynamoDB el campo `ultimoAcceso` (ISO 8601, hora del servidor) tras un inicio de sesión exitoso en Cognito o la confirmación de contraseña nueva. No recibe `usuarioId` ni fecha desde el cliente.
  - Roles permitidos: Todos los usuarios autenticados y activos; solo se actualiza el propio registro.
- **GET /api/v1/usuarios**
  - Descripcion: Listar usuarios registrados.
  - Roles permitidos: ADMINISTRADOR, RRHH.
- **GET /api/v1/usuarios/{usuarioId}**
  - Descripcion: Consultar usuario por identificador.
  - Roles permitidos: ADMINISTRADOR, RRHH.
- **POST /api/v1/usuarios**
  - Descripcion: Crear registro interno de usuario vinculado a Cognito. El cuerpo acepta `nombre`, `email` y `rol` opcional; `usuarioId`, `cognitoSub` y `estado` se resuelven en el backend y no deben enviarse desde React.
  - Roles permitidos: ADMINISTRADOR activo, según las comprobaciones del handler.
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
  - Descripcion: Listar plantilla con filtros `estado`, `cargoId` y `rolProfesional`.
  - Paginacion: `limit` (entero entre 1 y 100, predeterminado 25) y `cursor` (token opaco `base64url` recibido como `datos.nextCursor` en la respuesta anterior). La respuesta conserva `datos.items` y `datos.lastKey` por compatibilidad y agrega `datos.nextCursor`, que es `null` al terminar. Un cursor inválido devuelve 400. No deben fabricarse cursores manualmente. DynamoDB filtra después de leer la página: puede devolver menos de `limit`, incluso cero elementos, y todavía proporcionar `nextCursor`; debe continuarse mientras no sea `null`.
- **POST /api/v1/colaboradores**
  - Descripcion: Dar de alta un colaborador. Requiere `usuarioId`, `cargoId` y `rolProfesional`; `colaboradorId` es opcional (UUID automático). La creación reserva `USUARIO#<usuarioId>` en la misma transacción para impedir duplicados concurrentes.
- **GET /api/v1/colaboradores/{colaboradorId}**
  - Descripcion: Consultar detalle de colaborador por PK.
- **GET /api/v1/colaboradores/yo**
  - Descripcion: Consultar el perfil de colaborador asociado a la identidad Cognito autenticada; retorna 404 si no existe.
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
  - Descripcion: Crear un cargo nuevo en el catalogo. `cargoId` es opcional y se genera automáticamente si falta.
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
  - Descripcion: Crear nueva habilidad (`habilidadId` opcional; UUID automático). El nombre normalizado se reserva transaccionalmente para impedir duplicados exactos.
- **GET /api/v1/habilidades/categorias**
  - Descripcion: Listar categorias disponibles, recorriendo las paginas del catalogo de habilidades y excluyendo los marcadores internos de unicidad. Devuelve un arreglo de nombres ordenados.
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
  - Descripcion: Registrar requerimiento de proyecto con estado inicial `BORRADOR`. El backend rechaza crearlo directamente como `ACTIVO`; debe asociarse primero una o más habilidades requeridas.
- **GET /api/v1/proyectos/{proyectoId}**
  - Descripcion: Consultar proyecto por identificador.
- **PUT /api/v1/proyectos/{proyectoId}**
  - Descripcion: Actualizar alcance, fechas u horas requeridas.
- **PATCH /api/v1/proyectos/{proyectoId}/estado**
  - Descripcion: Publicar, cancelar o cambiar estado de proyecto (sin borrado físico). Para pasar de `BORRADOR` a `ACTIVO`, exige al menos una habilidad en ProyectoHabilidad y registra la primera `fechaPublicacion` con fecha del servidor.
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
- **PATCH /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}/retirar**
  - Descripcion: Retirar una postulacion segun los permisos del colaborador autenticado.

---

### 2.8 Modulo 07: Asignaciones
- **Funcion Lambda:** `AsignacionesFunction` (`src/functions/asignaciones/handler.js`)
- **Tablas DynamoDB:** `internal-marketplace-asignaciones-dev` (PK: `asignacionId`, GSIs por colaborador, proyecto y estado)

- **GET /api/v1/asignaciones**
  - Descripcion: Alias del listado de asignaciones activas; no consulta historicos desvinculados.
- **POST /api/v1/asignaciones**
  - Descripcion: Crear asignacion directa comprobando que la dedicacion total no supere el 100%, que no exista duplicación y que el colaborador no sea el mismo usuario que el líder del proyecto. Esta última regla se valida también de forma transaccional en DynamoDB.
- **Regla de separación de responsabilidades:** un líder no puede postularse ni ser asignado a un proyecto que dirige. También se aplica al aceptar postulaciones; la comparación se realiza entre `Colaboradores.usuarioId` y `Proyectos.liderId`. Las cuentas sin identidad verificable no pueden generar asignaciones nuevas.
- **GET /api/v1/asignaciones/mias**
  - Descripcion: Consultar las asignaciones personales de la cuenta autenticada, incluso cuando su rol es Líder de Proyecto y participa en proyectos de otros líderes. El servidor obtiene el `colaboradorId` mediante `usuarioAutenticado.usuarioId`, sin aceptar IDs proporcionados por el cliente.
  - Roles permitidos: usuarios autenticados activos. Respuesta `datos.items` (incluye historial) y `datos.tienePerfil` (booleano). No concede privilegios para gestionar asignaciones ajenas.
- **GET /api/v1/asignaciones/activas**
  - Descripcion: Consultar asignaciones activas mediante GSI3. Las lecturas de GSI son eventualmente consistentes y no reemplazan la condición transaccional sobre `dedicacionReservada`.
- **GET /api/v1/asignaciones/{asignacionId}**
  - Descripcion: Consultar asignacion por identificador unico.
- **PUT /api/v1/asignaciones/{asignacionId}**
  - Descripcion: Modificar horas o porcentaje de dedicacion activa.
- **PATCH /api/v1/asignaciones/{asignacionId}/estado**
  - Descripcion: Desvincular colaborador enviando `{ "estado": "DESVINCULADA" }` (registro de fecha y liberacion de dedicacion).
- **DELETE /api/v1/asignaciones/{asignacionId}**
  - Descripcion: Desvincular logicamente una asignacion; conserva el registro historico.
- **GET /api/v1/colaboradores/{colaboradorId}/asignaciones**
  - Descripcion: Consultar las asignaciones del colaborador indicado, incluido el historial, según autorización. Para consultas personales del líder o empleado se recomienda `/asignaciones/mias`.
- **GET /api/v1/proyectos/{proyectoId}/asignaciones**
  - Descripcion: Consultar asignaciones del proyecto (incluido su historial) según los permisos del rol. La gestión de un líder se limita a proyectos que dirige.

---

### 2.9 Modulo 08: Busqueda y Algoritmo de Coincidencia
- **Funcion Lambda:** `BusquedaFunction` (`src/functions/busqueda/handler.js`)
- **Tablas DynamoDB:** `internal-marketplace-colaborador-habilidad-dev`, `internal-marketplace-habilidades-dev`, `internal-marketplace-colaboradores-dev`, `internal-marketplace-cargos-dev`

- **GET /api/v1/busqueda/colaboradores?habilidades={id1,id2}&nivelMinimo=MID&tipoCoincidencia=todas&considerarDisponibilidad=true&limit=50**
  - Descripcion: Buscar candidatos activos por habilidades y nivel. La disponibilidad se determina con `100 - dedicacionReservada`, y los registros sin dedicación válida no se consideran disponibles. La respuesta incluye `total` de coincidencias antes del límite, `devueltos`, `candidatos`, puntuaciones y habilidades faltantes.
  - Parametros: `habilidades` obligatorio; `nivelMinimo` (`JUNIOR`, `MID`, `SENIOR`); `tipoCoincidencia` (`todas`, `alguna`); `considerarDisponibilidad` (`true`, `false`); `limit` entero de 1 a 100.
- **GET /api/v1/busqueda/proyectos?estado=ACTIVO&nombre={termino}**
  - Descripcion: Buscar proyectos por estado y texto del nombre. Tambien admite `liderId` y `fecha`; no filtra proyectos por `habilidadId`.
- **GET /api/v1/busqueda/habilidades?nombre={termino}**
  - Descripcion: Consultar habilidades mediante los filtros admitidos por el repositorio (`nombre`, `categoria`, `estado`).

---

### 2.10 Modulo 09: Dashboard y Metricas
- **Funcion Lambda:** `DashboardFunction` (`src/functions/dashboard/handler.js`)
- **Acceso:** Consultas agregadas mediante GSIs y lecturas paginadas; la distribución de habilidades y el conteo de postulaciones realizan scans limitados a sus tablas correspondientes.

- **GET /api/v1/dashboard/resumen**
  - Descripcion: Metricas consolidadas (colaboradores activos, proyectos por estado, asignaciones).
- **GET /api/v1/dashboard/{tipoMetrica}**
  - Descripcion: Desglose especifico de metricas (`colaboradores`, `proyectos`, `asignaciones`, `habilidades`, `postulaciones`).

---

### 2.11 Modulo 10: Administración y Auditoría
- **Funcion Lambda:** `AdministracionFunction` (`src/functions/administracion/handler.js`).
- **Tabla DynamoDB:** `internal-marketplace-auditoria-{entorno}` (PK: `auditoriaId`; GSI1: `tipoRegistro` + `fechaId`). Se crea con SAM y facturación bajo demanda.
- **GET /api/v1/administracion/auditoria**
  - Descripcion: Consultar los eventos persistidos que se generaron después de habilitar la auditoría.
  - Rol permitido: únicamente `ADMINISTRADOR`.
  - Parametros: `desde` y `hasta` (YYYY-MM-DD, horario de El Salvador), `limite` (1-100) y `cursor` paginado.
  - Respuesta: `datos.items` y `datos.nextCursor`.
- **Registro automático de eventos:** el despachador guarda acciones de escritura exitosas (POST, PUT, PATCH y DELETE) y el inicio de sesión en la tabla de auditoría cuando `AUDIT_ENABLED=true`. El actor proviene de Cognito y no del cliente. No se almacenan credenciales ni tokens.
- **Interfaz administrativa:** `Administrador → Auditoría` consulta los eventos persistidos, con filtros por usuario, entidad, tipo de acción y fechas. Los eventos anteriores al despliegue de la tabla no se atribuyen retroactivamente a un usuario.
- **Limitaciones:** no se pueden reconstruir identidades de eventos anteriores sin registros históricos verificables. Una caída aislada del registro de auditoría se deja en CloudWatch y no revierte una operación de negocio que ya fue confirmada; debe vigilarse ese fallo para detectar brechas de auditoría.
