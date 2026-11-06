const { error } = require('./responses');
const { CODIGOS } = require('./errors');

/**
 * Crea un despachador de rutas para handlers de Lambda (API Gateway).
 * @param {Object} routes - Mapa de rutas: { 'GET /path': handlerFn, 'POST /path': handlerFn }
 * @returns {Function} Función handler Lambda (event, context) => response
 */
function crearDespachador(routes) {
  return async function handler(event, context) {
    try {
      const httpMethod = event.httpMethod || event.requestContext?.http?.method;
      const path = event.resource || event.path || event.rawPath || '';
      const key = `${httpMethod} ${path}`;

      const handlerFn = routes[key];

      if (!handlerFn) {
        return error('Ruta no encontrada', 404, CODIGOS.NO_ENCONTRADO);
      }

      return await handlerFn(event, context);
    } catch (err) {
      return error(err.message, err.codigo || 500, err.codigoError || CODIGOS.INTERNO);
    }
  };
}

module.exports = { crearDespachador };
