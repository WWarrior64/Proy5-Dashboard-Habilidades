const { exito } = require('../../utils/responses');

/**
 * Handler de comprobación de funcionamiento (/health).
 *
 * Contrato de handlers de Lambda (API Gateway - Lambda proxy integration):
 *  - event: objeto del evento de API Gateway. Contiene httpMethod, path,
 *    pathParameters (parámetros de ruta, ej. { id: '123' }),
 *    queryStringParameters (query string), body (cadena JSON del cuerpo),
 *    headers y requestContext.
 *  - context: objeto del contexto de ejecución de Lambda. Contiene functionName,
 *    functionVersion, invokedFunctionArn, memoryLimitInMB, awsRequestId,
 *    logGroupName, logStreamName y getRemainingTimeInMillis().
 *
 * @param {Object} event - Evento de API Gateway Lambda proxy.
 * @param {Object} context - Contexto de ejecución de Lambda.
 * @returns {Object} Respuesta Lambda { statusCode, headers, body }.
 */
async function health(event, context) {
  return exito(
    {
      status: 'ok',
      servicio: 'internal-marketplace-api',
      entorno: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
    200
  );
}

module.exports = { health, handler: health };