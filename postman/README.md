Guía de Pruebas con Postman - Internal Marketplace API

Este directorio contiene la colección y el entorno de Postman para probar la API Serverless. La colección original fue preparada para una versión anterior del contrato y puede no incluir rutas añadidas posteriormente. Se debe contrastar su cobertura con `docs/api/api-documentation.md` antes de considerarla completa.

Archivos incluidos

internal-marketplace.postman_collection.json: Colección organizada en los módulos originales (00 a 09), con aserciones pm.test y captura de identificadores. Las operaciones de Administración/Auditoría y las rutas personales más recientes pueden requerir su incorporación a la colección.

internal-marketplace.postman_environment.json: Entorno con las variables globales requeridas sin credenciales ni tokens reales expuestos.

Configuración inicial

Abre Postman.

Haz clic en Import (esquina superior izquierda) y selecciona ambos archivos JSON de esta carpeta.

En la esquina superior derecha, selecciona el entorno Internal Marketplace - Desarrollo.

Verifica que baseUrl apunte a tu API desplegada o a SAM Local:

AWS Desplegado: https://hcy3yy7u7c.execute-api.us-east-2.amazonaws.com/prod/api/v1

SAM Local: http://127.0.0.1:3000/api/v1

Autenticación (Cognito)

Las peticiones de las carpetas 01 a 09 requieren un JWT válido (IdToken de un usuario con rol ADMINISTRADOR). Coloca el token obtenido en la variable de entorno token:

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

La colección original incluye scripts `pm.test` con aserciones y captura de variables. No debe suponerse que cubre las rutas nuevas ni que todas las peticiones sigan usando los cuerpos vigentes; revisar especialmente el ciclo `BORRADOR → habilidades → ACTIVO`. Ejecución desde la raíz:

npx newman run postman/internal-marketplace.postman_collection.json \
  -e postman/internal-marketplace.postman_environment.json \
  --delay-request 250