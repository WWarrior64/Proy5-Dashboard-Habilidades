const cache = require('../src/services/cache.service.js');

describe('Caché: eliminación', () => {
  test('no devuelve ni almacena entradas de caché dentro de AWS Lambda', () => {
    const original = process.env.AWS_LAMBDA_FUNCTION_NAME;
    try {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      cache.guardar('proyectos:activos', [{ proyectoId: 'p1' }], 60000);
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'internal-marketplace-proyectos-prod';
      expect(cache.obtener('proyectos:activos')).toBeUndefined();
      cache.guardar('proyecto:p2', { proyectoId: 'p2' }, 60000);
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      expect(cache.obtener('proyecto:p2')).toBeUndefined();
    } finally {
      if (original === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      else process.env.AWS_LAMBDA_FUNCTION_NAME = original;
    }
  });

  beforeEach(() => cache.limpiar());
  afterEach(() => cache.limpiar());

  test('eliminar borra solo la clave indicada y comunica si existía', () => {
    cache.guardar('proyecto:1', { nombre: 'Uno' });
    cache.guardar('proyecto:2', { nombre: 'Dos' });
    expect(cache.eliminar('proyecto:1')).toBe(true);
    expect(cache.obtener('proyecto:1')).toBeUndefined();
    expect(cache.obtener('proyecto:2')).toEqual({ nombre: 'Dos' });
    expect(cache.eliminar('proyecto:1')).toBe(false);
  });
});