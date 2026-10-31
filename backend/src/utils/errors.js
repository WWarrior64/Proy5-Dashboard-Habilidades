class ErrorApp extends Error {
  constructor(mensaje, codigo = 500) {
    super(mensaje);
    this.codigo = codigo;
  }
}

module.exports = { ErrorApp };