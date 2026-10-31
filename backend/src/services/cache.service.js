const cache = new Map();

function obtenerClave(clave) {
  return cache.get(clave);
}

function guardarClave(clave, valor) {
  cache.set(clave, valor);
}

module.exports = { obtenerClave, guardarClave };