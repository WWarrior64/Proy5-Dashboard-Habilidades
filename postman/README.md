# Guía de Pruebas con Postman - Internal Marketplace API

Este directorio contiene la colección y el entorno oficial de Postman para probar los endpoints del backend Serverless.

## Archivos incluidos

* `internal-marketplace.postman_collection.json`: Colección completa organizada en 10 módulos funcionales (00 a 09).
* `internal-marketplace.postman_environment.json`: Entorno con las variables globales requeridas.

## Configuración inicial

1. Abre **Postman**.
2. Haz clic en **Import** (esquina superior izquierda) y selecciona ambos archivos JSON de esta carpeta.
3. En la esquina superior derecha, selecciona el entorno **Internal Marketplace - Development**.
4. Verifica que `baseUrl` apunte a tu API desplegada o a SAM Local:
   * **AWS Desplegado:** `https://hcy3yy7u7c.execute-api.us-east-2.amazonaws.com/prod/api/v1`
   * **SAM Local:** `http://127.0.0.1:3000/api/v1`

## Autenticación (Cognito)

Las peticiones de las carpetas 01 a 09 requieren un JWT válido. Coloca el token obtenido en la variable de entorno `token`:
* Las peticiones envían automáticamente la cabecera `Authorization: Bearer {{token}}`.
* El endpoint `00 - Health / Verificar API` es público y no requiere autenticación.

## Flujo mínimo de prueba (Secuencia de verificación)

1. **00 - Health**: Ejecutar `GET /health` (Verifica que responde `200 OK`).
2. **04 - Habilidades**:
   * Ejecutar `POST /habilidades` (Crea la habilidad, valida `201 Created` y guarda automáticamente `habilidadId`).
   * Ejecutar `GET /habilidades/{{habilidadId}}` (Valida respuesta `200 OK` con los datos creados).
   * Ejecutar `GET /habilidades` (Comprueba que la habilidad aparece en el listado general).
   * Ejecutar `PATCH /habilidades/{{habilidadId}}/estado` (Modifica el estado).