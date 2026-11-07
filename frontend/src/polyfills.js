// Polyfill para amazon-cognito-identity-js en entornos de navegador (Vite/ESM)
// Este archivo debe importarse ANTES que cualquier módulo que use Cognito
if (typeof global === 'undefined') {
  window.global = window;
}

// También asegurar que process.exist esté definido para algunos paquetes
if (typeof process === 'undefined') {
  window.process = { env: {}, argv: [], version: '' };
}