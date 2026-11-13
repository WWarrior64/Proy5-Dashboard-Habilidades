const { error } = require('./responses');
const { CODIGOS } = require('./errors');
const { autenticar } = require('../middleware/authentication');
const { proteger } = require('../middleware/route-policy');
const auditoria = require('../repositories/auditoria.repository');

/**
 * Crea un despachador de rutas para handlers de Lambda (API Gateway).
 * @param {Object} routes - Mapa de rutas: { 'GET /path': handlerFn, 'POST /path': handlerFn }
 * @returns {Function} Función handler Lambda (event, context) => response
 */
function crearDespachador(routes) {
  return async function handler(event, context) {
    try {
      const httpMethod = event.httpMethod || event.requestContext?.http?.method;
      const path = (event.path || event.rawPath || event.resource || '').replace(/\{([^}]+)\}/g,
        (match, key) => event.pathParameters?.[key] || match);
      const keys = Object.keys(routes).sort((a, b) =>
        (a.match(/\{/g) || []).length - (b.match(/\{/g) || []).length);
      let selected;
      for (const key of keys) {
        const [method, template] = key.split(' ');
        if (method !== httpMethod) continue;
        const parts = template.split('/');
        const actual = path.split('/');
        if (parts.length !== actual.length) continue;
        const params = {};
        const matches = parts.every((part, i) => {
          if (!part.startsWith('{')) return part === actual[i];
          if (!actual[i] || actual[i].startsWith('{')) return false;
          params[part.slice(1, -1)] = decodeURIComponent(actual[i]);
          return true;
        });
        if (matches) {
          selected = key;
          event.pathParameters = { ...event.pathParameters, ...params };
          break;
        }
      }
      const handlerFn = routes[selected];

      if (!handlerFn) {
        return error('Ruta no encontrada', 404, CODIGOS.NO_ENCONTRADO);
      }

      if (selected === 'GET /api/v1/health') return handlerFn(event, context);
      return await autenticar(event, async (authenticated) => {
        await proteger(authenticated, selected);
        const respuesta = await handlerFn(authenticated, context);
        if (process.env.AUDIT_ENABLED === 'true' &&
          httpMethod !== 'GET' && respuesta?.statusCode >= 200 && respuesta.statusCode < 300) {
          try {
            await auditoria.registrarDesdeSolicitud(authenticated, selected, respuesta);
          } catch (falloAuditoria) {
            // La mutación ya se ejecutó: no devolver un error que provoque duplicarla al reintentar.
            console.error('No se pudo persistir el evento de auditoría', {
              tipo: falloAuditoria.name, requestId: context?.awsRequestId, ruta: selected,
            });
          }
        }
        return respuesta;
      });
    } catch (err) {
      if (!err.codigo || err.codigo >= 500) {
        console.error('Error interno al despachar petición', {
          tipo: err.name, mensaje: err.message, awsRequestId: context?.awsRequestId,
        });
      }
      return error(err.message, err.codigo || 500, err.codigoError || CODIGOS.INTERNO);
    }
  };
}

module.exports = { crearDespachador };
