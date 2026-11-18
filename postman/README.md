Guía de Pruebas con Postman - Internal Marketplace API

Este directorio contiene la colección y el entorno de Postman para probar la API Serverless. La colección reúne las rutas declaradas en AWS SAM y solicitudes adicionales de validación y autorización, incluida la eliminación definitiva de colaboradores. La presencia de una ruta en Postman no sustituye la prueba contra la API desplegada.

Archivos incluidos

internal-marketplace.postman_collection.json: Colección organizada por dominios (00 a 11), con solicitudes para los procesos CRUD, pruebas de respuestas y captura de identificadores. Incluye las rutas personales, Administración/Auditoría y casos de error.

internal-marketplace.postman_environment.json: Entorno con las variables globales requeridas sin credenciales ni tokens reales expuestos.

Configuración inicial

Abre Postman.

Haz clic en Import (esquina superior izquierda) y selecciona ambos archivos JSON de esta carpeta.

En la esquina superior derecha, selecciona el entorno Internal Marketplace - Desarrollo.

Verifica que baseUrl apunte a tu API desplegada o a SAM Local:

AWS Desplegado: https://hcy3yy7u7c.execute-api.us-east-2.amazonaws.com/prod/api/v1

SAM Local: http://127.0.0.1:3000/api/v1

Autenticación (Cognito)

Las peticiones protegidas requieren un ID Token válido de Cognito. Para administrar los recursos utiliza un usuario ADMINISTRADOR y configura la variable de entorno `token`; para comprobar permisos configura también `tokenEmpleado` con el ID Token de una cuenta EMPLEADO activa.

Las peticiones envían automáticamente la cabecera Authorization: Bearer {{token}}.

El endpoint 00 - Health / Verificar API es público y no requiere autenticación.

Flujo mínimo de prueba (Secuencia de verificación)

00 - Health: Ejecutar GET /health (Verifica que responde 200 OK).

04 - Habilidades:

Ejecutar POST /habilidades (Crea la habilidad, valida 201 Created y guarda automáticamente habilidadId).

Ejecutar GET /habilidades/{{habilidadId}} (Valida respuesta 200 OK con los datos creados).

Ejecutar GET /habilidades (Comprueba que la habilidad aparece en el listado general).

Ejecutar PATCH /habilidades/{{habilidadId}}/estado (Modifica el estado).

03 - Cargos y 01 - Usuarios:

Ejecutar POST /cargos (Crea un cargo y guarda cargoId).

Ejecutar POST /usuarios con email, nombre y rol (Crea el usuario en Cognito/DynamoDB y guarda usuarioId).

Ejecutar PUT /usuarios/{{usuarioId}} enviando únicamente nombre (el cambio de correo se gestiona exclusivamente desde Cognito).

02 - Colaboradores:

Ejecutar POST /colaboradores asociando usuarioId y cargoId (guarda colaboradorId).

Ejecutar POST /colaboradores/{{colaboradorId}}/habilidades usando el campo anosExperiencia.

Para dar de baja, utilizar PATCH /colaboradores/{{colaboradorId}}/estado con activo=false. El DELETE /colaboradores/{{colaboradorId}} anterior también realiza baja lógica y no borra el perfil.

La solicitud «Eliminar definitivamente colaborador inactivo (MANUAL)» utiliza DELETE /colaboradores/{{colaboradorEliminarId}}/definitivo. Solo elimina perfiles inactivos sin historial de asignaciones ni postulaciones; elimina también sus relaciones de habilidades y libera la reserva del usuario, pero conserva la cuenta de usuario. Configura un ID de prueba independiente en colaboradorEliminarId y, exclusivamente cuando vayas a ejecutarla, establece confirmarEliminacionDefinitiva=true. La solicitud se omite por defecto al ejecutar la colección para evitar pérdidas accidentales. El éxito devuelve 200 con datos.eliminado=true; si el perfil no puede eliminarse por sus dependencias devuelve 409.

05 - Proyectos, 06 - Postulaciones y 07 - Asignaciones:

Ejecutar POST /proyectos con estado `BORRADOR` (guarda proyectoId); asociar al menos una habilidad requerida mediante POST /proyectos/{{proyectoId}}/habilidades y después activar el proyecto con PATCH /proyectos/{{proyectoId}}/estado. Finalmente, verificar GET /proyectos?estado=ACTIVO. La publicación directa sin habilidades debe rechazarse.

Ejecutar POST /postulaciones (guarda postulacionId) y POST /asignaciones (guarda asignacionId), utilizando un colaborador **distinto del líder del proyecto**. Verificar que la dedicación acumulada no supere el 100 %, que no se pueda asignar dos veces el mismo colaborador al mismo proyecto y que un líder sí pueda colaborar en proyectos de otros líderes.

08 - Búsqueda y 09 - Dashboard:

Ejecutar GET /busqueda/colaboradores?habilidades={{habilidadId}} y GET /dashboard/resumen.

Comprobaciones adicionales de la versión reciente

- `POST /usuarios/yo/acceso`: con token de usuario activo, registra `ultimoAcceso` en DynamoDB; `GET /usuarios/yo` no debe modificarlo.
- `GET /asignaciones/mias`: con token de líder que posee perfil de colaborador, devuelve sus participaciones en proyectos ajenos. No recibe IDs del usuario ni del colaborador y no concede permisos de gestión.
- `GET /administracion/auditoria`: solo debe responder a `ADMINISTRADOR`; permite consultar eventos nuevos por `desde`, `hasta`, `limite` y `cursor`.
- Verificar estados `ACTIVA`, `FINALIZADA`, `DESVINCULADA` y reincorporación de colaboradores dados de baja con cuenta activa.
- Si una ruta nueva responde 403/`Unauthorized` o 404 en la URL publicada, comprobar despliegue de API Gateway/Lambda, token ID de Cognito y permisos, sin asumir que el código local ya está publicado.

Ejecución automatizada por CLI (Newman)

La colección incluye scripts `pm.test` con aserciones y captura de variables. Antes de ejecutarla contra AWS, revisa los cuerpos de las operaciones con efectos y utiliza únicamente datos de prueba. No ejecutes todas las solicitudes de modificación consecutivamente sin preparar su estado. Ejecución desde la raíz:

npx newman run postman/internal-marketplace.postman_collection.json \
  -e postman/internal-marketplace.postman_environment.json \
  --delay-request 250

Casos negativos adicionales

Antes de ejecutar la carpeta "11 - Validaciones y Casos Negativos", prepara registros de prueba independientes y conserva un token de ADMINISTRADOR para las operaciones ordinarias.

- `tokenEmpleado`: ID Token de un EMPLEADO activo; se utiliza para demostrar el rechazo 403 en Auditoría.
- `proyectoCanceladoId`: identificador de un proyecto previamente cancelado; intentar reactivarlo debe devolver 409, sin modificar el registro.
- `proyectoConHabilidadesId`: proyecto ACTIVO que exige habilidades obligatorias.
- `colaboradorSinHabilidadesId`: colaborador ACTIVO, diferente del líder, que no cumple las habilidades obligatorias anteriores y tiene su dedicación inicializada.
- Duplicidad: crear primero una asignación válida para `proyectoId` y `colaboradorId` y ejecutar después la solicitud de asignación duplicada. El segundo intento debe devolver 409.
- Verificar además con un usuario de rol insuficiente que las modificaciones sobre recursos ajenos reciben 403.

Los casos negativos no deben utilizar IDs de recursos importantes. No incluyas tokens ni contraseñas reales en el JSON versionado. El archivo de entorno proporciona valores vacíos para estos secretos. El `baseUrl` exportado es una plantilla de desarrollo: actualízalo conscientemente en Postman a la API que estés probando. No apuntes a producción para ejecutar en bloque operaciones de creación, baja o cancelación.

La compilación del frontend requiere `VITE_API_URL` con la URL completa de la API seleccionada, incluida la ruta /api/v1. Configúrala como variable de GitHub Actions o del entorno de publicación; nunca uses una URL ficticia.

Medición real de rendimiento

El script `backend/scripts/medirRendimiento.js` únicamente simula operaciones y latencia. Para obtener evidencia real, ejecuta `node backend/scripts/medirRendimientoAWS.js` desde la raíz, después de definir `API_BASE_URL` (con /api/v1), `API_ID_TOKEN` de un usuario autorizado y, opcionalmente, `PERF_HABILIDADES` (IDs separados por comas) y `PERF_REPETICIONES` (2 a 30). El script solo realiza lecturas GET y entrega tiempos promedio, p50, p95, más aciertos de caché confirmados por la respuesta. Ejecuta las mediciones contra la aplicación publicada y conserva los resultados como evidencia.

La caché en memoria no se comparte entre instancias de Lambda: las solicitudes sucesivas pueden atenderse en instancias distintas. Para evaluar lecturas consumidas y latencia de los servicios AWS, complementa los tiempos HTTP con CloudWatch y métricas DynamoDB.