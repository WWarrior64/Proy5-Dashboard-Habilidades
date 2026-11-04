/**
 * Catálogo de códigos de error aplicativo estandarizados.
 * Se usan junto al código de estado HTTP para clasificar el error de forma unívoca.
 */
const CODIGOS = {
  VALIDACION: 'VALIDATION_ERROR',
  NO_ENCONTRADO: 'NOT_FOUND',
  NO_AUTORIZADO: 'UNAUTHORIZED',
  PROHIBIDO: 'FORBIDDEN',
  CONFLICTO: 'CONFLICT',
  INTERNO: 'INTERNAL_SERVER_ERROR',
};

/**
 * Error aplicativo con código de estado HTTP y código de error aplicativo.
 * Compatible con el formato de respuestas Lambda definido en responses.js.
 */
class ErrorApp extends Error {
  /**
   * @param {string} mensaje - Mensaje descriptivo del error.
   * @param {number} codigo - Código de estado HTTP (por defecto 500).
   * @param {string} codigoError - Código de error aplicativo (por defecto INTERNAL_SERVER_ERROR).
   */
  constructor(mensaje, codigo = 500, codigoError = CODIGOS.INTERNO) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.codigo = codigo;
    this.codigoError = codigoError;
  }
}

module.exports = { ErrorApp, CODIGOS };