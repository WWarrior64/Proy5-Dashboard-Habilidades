Guía de Pruebas con Postman - Internal Marketplace API

Este directorio contiene la colección y el entorno oficial de Postman para probar los 58 endpoints del backend Serverless.

Archivos incluidos

internal-marketplace.postman_collection.json: Colección completa organizada en 10 módulos funcionales (00 a 09), con aserciones pm.test en cada solicitud y captura automática de identificadores (usuarioId, colaboradorId, cargoId, habilidadId, proyectoId, postulacionId, asignacionId).

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

Ejecutar POST /proyectos (guarda proyectoId) y verificar GET /proyectos?estado=ACTIVO.

Ejecutar POST /postulaciones (guarda postulacionId) y POST /asignaciones (guarda asignacionId).

08 - Búsqueda y 09 - Dashboard:

Ejecutar GET /busqueda/colaboradores?habilidades={{habilidadId}} y GET /dashboard/resumen.

Ejecución automatizada por CLI (Newman)

Todas las 58 peticiones incluyen scripts pm.test con aserciones de código HTTP, validación de esquema JSON y captura automática de variables de entorno:

npx newman run postman/internal-marketplace.postman_collection.json \
  -e postman/internal-marketplace.postman_environment.json \
  --delay-request 250