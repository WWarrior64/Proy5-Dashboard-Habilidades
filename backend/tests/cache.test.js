const cache = require('../src/services/cache.service.js');

describe('Caché: eliminación', () => {
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