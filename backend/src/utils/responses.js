const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Respuesta estándar compatible con AWS Lambda (API Gateway - Lambda proxy integration).
 * @param {any} datos - Cuerpo de la respuesta exitosa.
 * @param {number} codigo - Código de estado HTTP (por defecto 200).
 * @returns {Object} Objeto { statusCode, headers, body } listo para devolver en un handler de Lambda.
 */
function exito(datos, codigo = 200) {
  return {
    statusCode: codigo,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      datos,
      mensaje: 'Operación exitosa',
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Respuesta de creación (HTTP 201).
 * @param {any} datos - Cuerpo de la respuesta exitosa.
 * @returns {Object} Objeto { statusCode, headers, body } con statusCode 201.
 */
function creado(datos) {
  return exito(datos, 201);
}

/**
 * Respuesta de error estándar compatible con Lambda.
 * @param {string} mensaje - Mensaje descriptivo del error.
 * @param {number} codigo - Código de estado HTTP (por defecto 500).
 * @param {string} codigoError - Código de error aplicativo (ej. 'VALIDATION_ERROR').
 * @returns {Object} Objeto { statusCode, headers, body } listo para devolver en un handler de Lambda.
 */
function error(mensaje, codigo = 500, codigoError = null) {
  const cuerpo = {
    success: false,
    error: {
      mensaje,
      ...(codigoError && { codigo: codigoError }),
      timestamp: new Date().toISOString(),
    },
  };
  return {
    statusCode: codigo,
    headers: CORS_HEADERS,
    body: JSON.stringify(cuerpo),
  };
}

module.exports = { exito, creado, error, CORS_HEADERS };