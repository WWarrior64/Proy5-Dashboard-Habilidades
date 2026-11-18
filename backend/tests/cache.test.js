/* global describe, test, expect, beforeEach, afterEach */
const cache = require('../src/services/cache.service.js');

const TTL_CORTO_MS = 60;

describe('Caché de proceso por instancia (compatible con AWS Lambda)', () => {
  beforeEach(() => {
    // La caché está siempre activa (ya no se desactiva por AWS_LAMBDA_FUNCTION_NAME).
    // Cada test empieza con la caché vacía y contadores de estadística reiniciados.
    cache.limpiar();
  });

  afterEach(() => cache.limpiar());

  describe('estaHabilitada', () => {
    test('está activa también cuando se simula ejecución en AWS Lambda', () => {
      const original = process.env.AWS_LAMBDA_FUNCTION_NAME;
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'internal-marketplace-cargos-prod';
      try {
        expect(cache.estaHabilitada()).toBe(true);
      } finally {
        if (original === undefined) {delete process.env.AWS_LAMBDA_FUNCTION_NAME;}
        else {process.env.AWS_LAMBDA_FUNCTION_NAME = original;}
      }
    });
  });

  describe('construirClave', () => {
    test('diferencia filtros y parámetros de paginación en claves independientes', () => {
      const base = cache.construirClave('cargos', 'list', 'ACTIVO', '10', '');
      const conEstado = cache.construirClave('cargos', 'list', 'INACTIVO', '10', '');
      const conOtroLimit = cache.construirClave('cargos', 'list', 'ACTIVO', '25', '');
      const conLastKey = cache.construirClave(
        'cargos', 'list', 'ACTIVO', '10', JSON.stringify({ cargoId: 'ultimo' }),
      );

      expect(base).not.toBe(conEstado);
      expect(base).not.toBe(conOtroLimit);
      expect(base).not.toBe(conLastKey);
      expect(conEstado).not.toBe(conOtroLimit);
      expect(conLastKey).toContain('ultimo');
    });

    test('ignora partes vacías, nulas e indefinidas', () => {
      expect(cache.construirClave('a', '', null, undefined, 'b')).toBe('a:b');
    });
  });

  describe('guardar / obtener', () => {
    test('guarda y obtiene un valor', () => {
      cache.guardar('clave:1', { dato: 'valor' });
      expect(cache.obtener('clave:1')).toEqual({ dato: 'valor' });
    });

    test('retorna undefined para clave inexistente', () => {
      expect(cache.obtener('no-existe')).toBeUndefined();
    });

    test('sobrescribe el valor al guardar la misma clave', () => {
      cache.guardar('clave:2', { v: 1 }, TTL_CORTO_MS);
      cache.guardar('clave:2', { v: 2 }, TTL_CORTO_MS);
      expect(cache.obtener('clave:2')).toEqual({ v: 2 });
    });

    test('almacena y devuelve null (caché de negativa) sin confundirlo con miss', () => {
      cache.guardar('negativa', null);
      expect(cache.obtener('negativa')).toBeNull();
      const stats = cache.obtenerEstadisticas();
      expect(stats.hits).toBeGreaterThanOrEqual(1);
    });
  });

  describe('expiración automática por TTL', () => {
    test('expira automáticamente tras el TTL', async () => {
      cache.guardar('ttl:clave', { dato: 'valor' }, TTL_CORTO_MS);
      expect(cache.obtener('ttl:clave')).toEqual({ dato: 'valor' });

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(cache.obtener('ttl:clave')).toBeUndefined();
    });

    test('con TTL suficiente no expira durante la prueba', () => {
      cache.guardar('sin:expiracion', { dato: 'persiste' }, 60_000);
      expect(cache.obtener('sin:expiracion')).toEqual({ dato: 'persiste' });
    });

    test('las estadísticas cuentan expiraciones perezosas', async () => {
      cache.guardar('stats:ttl', { x: 1 }, TTL_CORTO_MS);
      await new Promise((resolve) => setTimeout(resolve, 80));
      cache.obtener('stats:ttl'); // miss + expiración perezosa

      const stats = cache.obtenerEstadisticas();
      expect(stats.misses).toBeGreaterThanOrEqual(1);
      expect(stats.expiracionesLimpieza).toBeGreaterThanOrEqual(1);
    });
  });

  describe('eliminar y eliminarPorPrefijo', () => {
    test('eliminar borra solo la clave indicada y comunica si existía', () => {
      cache.guardar('a:1', 1);
      cache.guardar('a:2', 2);

      expect(cache.eliminar('a:1')).toBe(true);
      expect(cache.obtener('a:1')).toBeUndefined();
      expect(cache.obtener('a:2')).toEqual(2);
      expect(cache.eliminar('a:1')).toBe(false);
    });

    test('eliminarPorPrefijo borra todas las claves con ese prefijo (invalidación de listados)', () => {
      cache.guardar('cargos:list:ACTIVO:10:', { items: [] });
      cache.guardar('cargos:list:INACTIVO:10:', { items: [] });
      cache.guardar('cargos:obtener:c1', { cargoId: 'c1' });

      const eliminadas = cache.eliminarPorPrefijo('cargos:list:');

      expect(eliminadas).toBe(2);
      expect(cache.obtener('cargos:list:ACTIVO:10:')).toBeUndefined();
      expect(cache.obtener('cargos:list:INACTIVO:10:')).toBeUndefined();
      expect(cache.obtener('cargos:obtener:c1')).toEqual({ cargoId: 'c1' });
    });
  });

  describe('capacidad máxima y expulsión LRU', () => {
    test('expulsa la entrada menos recientemente usada al superar la capacidad máxima (500)', () => {
      cache.limpiar();
      const entradaMasAntigua = cache.construirClave('cap', 'primera');
      cache.guardar(entradaMasAntigua, 1);
      for (let i = 1; i <= 520; i += 1) {
        cache.guardar(cache.construirClave('cap', String(i)), i);
      }

      // La primera entrada (más antigua, sin uso reciente) debe haberse expulsado.
      expect(cache.obtener(entradaMasAntigua)).toBeUndefined();

      const stats = cache.obtenerEstadisticas();
      expect(stats.entradasEvictadas).toBe(21); // 521 claves - 500 de capacidad
      expect(stats.entradasTotales).toBe(500);
      expect(stats.capacidadMaxima).toBe(500);

      // Las más recientes siguen presentes.
      expect(cache.obtener(cache.construirClave('cap', '520'))).toEqual(520);
      expect(cache.obtener(cache.construirClave('cap', '519'))).toEqual(519);
    });

    test('no expulsa mientras no se supere la capacidad máxima', () => {
      cache.limpiar();
      cache.guardar('solo:una', 1);
      cache.guardar('solo:dos', 2);
      expect(cache.obtener('solo:una')).toEqual(1);
      expect(cache.obtener('solo:dos')).toEqual(2);
      expect(cache.obtenerEstadisticas().entradasEvictadas).toBe(0);
    });
  });

  describe('estadísticas', () => {
    test('obtenerEstadisticas reporta hits, misses, solicitudes, tasa de hit, activas y expiradas', async () => {
      cache.guardar('s:activa', { v: 1 });
      cache.obtener('s:activa'); // hit
      cache.obtener('s:no-existe'); // miss
      cache.guardar('s:expirada', { v: 2 }, TTL_CORTO_MS);
      await new Promise((resolve) => setTimeout(resolve, 80));
      cache.obtener('s:expirada'); // expiración perezosa

      const stats = cache.obtenerEstadisticas();
      expect(stats.hits).toBeGreaterThanOrEqual(1);
      expect(stats.misses).toBeGreaterThanOrEqual(2);
      expect(stats.solicitudes).toBe(stats.hits + stats.misses);
      expect(stats.tasaHit).toBeGreaterThanOrEqual(0);
      expect(stats.tasaHit).toBeLessThanOrEqual(1);
      expect(typeof stats.entradasActivas).toBe('number');
      expect(typeof stats.entradasExpiradas).toBe('number');
      expect(typeof stats.capacidadMaxima).toBe('number');
      expect(typeof stats.escrituras).toBe('number');
    });

    test('limpiarExpirados elimina solo las entradas vencidas', async () => {
      cache.guardar('viva', 1);
      cache.guardar('muerta', 2, TTL_CORTO_MS);
      await new Promise((resolve) => setTimeout(resolve, 80));

      const eliminados = cache.limpiarExpirados();

      expect(eliminados).toBe(1);
      expect(cache.obtener('viva')).toEqual(1);
      expect(cache.obtener('muerta')).toBeUndefined();
    });

    test('limpiar vacía la caché y reinicia contadores', () => {
      cache.guardar('a', 1);
      cache.obtener('a');
      cache.limpiar();
      const stats = cache.obtenerEstadisticas();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.entradasTotales).toBe(0);
      expect(cache.obtener('a')).toBeUndefined();
    });
  });

  describe('invalidación inmediata tras escritura', () => {
    test('lectura repetida con caché, escritura e invalidación: la siguiente lectura obtiene el dato actualizado', () => {
      // Primera lectura: miss y guarda versión 1 (simula repositorio leyendo DynamoDB)
      cache.guardar('cargos:list:ACTIVO:25:', { version: 1, items: [{ cargoId: 'c1' }] });
      let lectura = cache.obtener('cargos:list:ACTIVO:25:');
      expect(lectura.version).toBe(1);

      // Escritura en el repositorio: invalida inmediatamente los prefijos afectados
      cache.eliminarPorPrefijo('cargos:list:');
      expect(cache.obtener('cargos:list:ACTIVO:25:')).toBeUndefined(); // dato obsoleto retirado

      // Nueva lectura: miss → el repositorio lee DynamoDB y devuelve versión 2 → se guarda
      cache.guardar('cargos:list:ACTIVO:25:', {
        version: 2,
        items: [{ cargoId: 'c1', nombre: 'Actualizado' }],
      });
      lectura = cache.obtener('cargos:list:ACTIVO:25:');
      expect(lectura.version).toBe(2);
      expect(lectura.items[0].nombre).toBe('Actualizado');
    });
  });
});