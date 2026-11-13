const { error } = require('../utils/responses');
const { CODIGOS } = require('../utils/errors');

/**
 * Middleware de validación para handlers de Lambda.
 * Valida el cuerpo de la petición usando un esquema Joi.
 *
 * @param {Object} schema - Esquema de Joi.
 * @returns {Function} Función que recibe (event, handler) y ejecuta el handler si es válido.
 */
function validar(schema) {
  return async function (event, handler) {
    try {
      let body = event.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return error('Cuerpo de la petición no es un JSON válido', 400, CODIGOS.VALIDACION);
        }
      }

      const { value, error: errorValidacion } = schema.validate(body, { abortEarly: false });

      if (errorValidacion) {
        const detalles = errorValidacion.details.map((detalle) => detalle.message).join('; ');
        return error(`Error de validación: ${detalles}`, 400, CODIGOS.VALIDACION);
      }

      event.bodyValidado = value;
      return await handler(event, {});
    } catch (err) {
      return error(err.message, err.codigo || 500, err.codigoError);
    }
  };
}

function validarDatos(schema, datos) {
  const { value, error: fallo } = schema.validate(datos, { abortEarly: false, noDefaults: true });
  if (fallo) {
    const { ErrorApp } = require('../utils/errors');
    throw new ErrorApp(`Error de validación: ${fallo.details.map((detalle) => detalle.message).join('; ')}`, 400, CODIGOS.VALIDACION);
  }
  return value;
}

module.exports = { validar, validarDatos };