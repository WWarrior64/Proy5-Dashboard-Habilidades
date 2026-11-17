/* global describe, it, expect, beforeEach, afterEach */
const {
  ejecutarTodo,
  medirCatalogo,
  medirDashboard,
  medirInvalidacion,
  medirCapacidad,
  medirExpiracion,
  resetOperaciones,
  obtenerOperaciones,
  consultaDynamoDB,
} = require('../scripts/medirRendimiento.js');

const cache = require('../src/services/cache.service.js');

describe('Script de mediciones de rendimiento - medirRendimiento.js (E07)', () => {
  beforeEach(() => {
    cache.limpiar();
    resetOperaciones();
  });

  afterEach(() => cache.limpiar());

  describe('medirCatalogo', () => {
    it('reporta ahorro de operaciones DynamoDB al usar caché (warm hit)', async () => {
      const reporte = await medirCatalogo({ repeticiones: 10 });

      expect(reporte.nombre).toBe('Catálogo de cargos (listar con filtros y paginación)');
      expect(reporte.repeticiones).toBe(10);
      // Sin caché: una lectura DynamoDB por repetición.
      expect(reporte.sinCache.operacionesDynamoDB).toBe(10);
      // Con caché: solo la primera lectura toca DynamoDB; el resto son hits.
      expect(reporte.conCache.operacionesDynamoDB).toBe(0);
      expect(reporte.conCache.hits).toBe(10);
      expect(reporte.operacionesAhorradas).toBe(10);
      // La primera consulta con caché realiza 1 lectura DynamoDB para poblarla.
      expect(reporte.primeraConsultaConCache.operacionesDynamoDB).toBe(1);
    });

    it('es más rápido con caché que sin ella', async () => {
      const reporte = await medirCatalogo({ repeticiones: 10 });
      expect(reporte.conCache.ms).toBeLessThan(reporte.sinCache.ms);
    });
  });

  describe('medirDashboard', () => {
    it('reporta ahorro de operaciones en las 6 métricas del dashboard', async () => {
      const reporte = await medirDashboard();

      expect(reporte.nombre).toBe('Dashboard resumen (6 métricas)');
      expect(reporte.sinCache.operacionesDynamoDB).toBe(6);
      expect(reporte.conCache.operacionesDynamoDB).toBe(0);
      expect(reporte.conCache.hits).toBe(6);
      expect(reporte.operacionesAhorradas).toBe(6);
      expect(reporte.primeraConsultaConCache.operacionesDynamoDB).toBe(6);
    });
  });

  describe('medirInvalidacion', () => {
    it('invalida la caché tras escritura y obtiene el dato actualizado (T26)', async () => {
      const reporte = await medirInvalidacion();

      expect(reporte.nombre).toBe('Invalidación inmediata tras escritura');
      // Antes de escribir, la caché cálida devuelve el dato.
      expect(reporte.antesDeEscribir.golpeaCaché).toBe(true);
      expect(reporte.antesDeEscribir.valor).toBe(1);
      // Tras la escritura, el prefijo se invalida: no golpea caché.
      expect(reporte.despuesDeEscribir.invalido).toBe(true);
      // Nueva lectura: miss → DynamoDB → dato fresco (versión 2).
      expect(reporte.lecturaTrasInvalidacion.datosActualizados).toBe(true);
      expect(reporte.lecturaTrasInvalidacion.valor).toBe(2);
    });
  });

  describe('medirCapacidad', () => {
    it('expulsa entradas antiguas (LRU) al superar la capacidad máxima', async () => {
      const reporte = await medirCapacidad();

      expect(reporte.nombre).toBe('Capacidad máxima y expulsión LRU');
      expect(reporte.capacidadMaxima).toBe(500);
      expect(reporte.expulsoEntradaAntigua).toBe(true);
      expect(reporte.entradasEvictadas).toBeGreaterThanOrEqual(1);
      expect(reporte.entradasTotales).toBe(500);
    });
  });

  describe('medirExpiracion', () => {
    it('expira automáticamente tras el TTL', async () => {
      const reporte = await medirExpiracion();

      expect(reporte.nombre).toBe('Expiración automática por TTL');
      expect(reporte.despuesDeGuardar).toBe(true);
      expect(reporte.despuesDeExpiracion.expirada).toBe(true);
      expect(reporte.despuesDeExpiracion.golpeaCaché).toBe(false);
    });
  });

  describe('ejecutarTodo', () => {
    it('ejecuta todas las mediciones y diferencia local vs Lambda', async () => {
      const reporte = await ejecutarTodo();

      expect(reporte.fecha).toBeDefined();
      expect(reporte.entorno).toBe('local (simulación)');
      expect(reporte.catalogo.operacionesAhorradas).toBeGreaterThanOrEqual(0);
      expect(reporte.dashboard.operacionesAhorradas).toBe(6);
      expect(reporte.invalidacion.lecturaTrasInvalidacion.datosActualizados).toBe(true);
      expect(reporte.capacidad.expulsoEntradaAntigua).toBe(true);
      expect(reporte.expiracion.despuesDeExpiracion.expirada).toBe(true);
    });
  });

  describe('consultaDynamoDB (simulador sin AWS)', () => {
    it('cuenta operaciones simuladas sin requerir credenciales de AWS', async () => {
      resetOperaciones();
      await consultaDynamoDB('prueba');
      await consultaDynamoDB('prueba');
      expect(obtenerOperaciones()).toBe(2);
    });
  });
});