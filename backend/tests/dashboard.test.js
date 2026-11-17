/* global describe, it, expect, beforeEach, afterEach, jest */
const dashboardHandler = require('../src/functions/dashboard/handler');
const dashboardRepo = require('../src/repositories/dashboard.repository');
const cache = require('../src/services/cache.service.js');

jest.mock('../src/repositories/dashboard.repository');

const eventoResumen = {
  httpMethod: 'GET',
  path: '/api/v1/dashboard/resumen',
};

const eventoColaboradores = {
  httpMethod: 'GET',
  path: '/api/v1/dashboard/colaboradores',
};

const eventoActividad = {
  httpMethod: 'GET',
  path: '/api/v1/dashboard/actividad',
};

describe('Módulo de Dashboard - Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Caché vacía y contadores reiniciados por test (las metadatos dependen de miss/hit).
    cache.limpiar();
  });

  afterEach(() => cache.limpiar());

  describe('obtenerResumenDashboard', () => {
    const metricas = {
      colaboradoresActivos: 12,
      proyectosPorEstado: { ACTIVO: 4, COMPLETADO: 2 },
      asignacionesActivas: 8,
      distribucionHabilidades: { frontend: 5, backend: 7 },
      postulacionesPorEstado: { PENDIENTE: 3, ACEPTADA: 5 },
      actividadReciente: [
        { tipo: 'POSTULACION_CREADA', fecha: '2026-11-10T10:00:00Z' },
      ],
    };

    beforeEach(() => {
      dashboardRepo.contarColaboradoresActivos.mockResolvedValue(metricas.colaboradoresActivos);
      dashboardRepo.contarProyectosPorEstado.mockResolvedValue(metricas.proyectosPorEstado);
      dashboardRepo.contarAsignacionesActivas.mockResolvedValue(metricas.asignacionesActivas);
      dashboardRepo.obtenerDistribucionHabilidades.mockResolvedValue(metricas.distribucionHabilidades);
      dashboardRepo.obtenerPostulacionesPorEstado.mockResolvedValue(metricas.postulacionesPorEstado);
      dashboardRepo.obtenerActividadReciente.mockResolvedValue(metricas.actividadReciente);
    });

    it('debe retornar métricas consolidadas con status 200 y metadatos de caché', async () => {
      const result = await dashboardHandler.obtenerResumenDashboard(eventoResumen, {});
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.datos.colaboradoresActivos).toBe(metricas.colaboradoresActivos);
      expect(body.datos.proyectosPorEstado).toEqual(metricas.proyectosPorEstado);
      expect(body.datos.asignacionesActivas).toBe(metricas.asignacionesActivas);
      expect(body.datos.distribucionHabilidades).toEqual(metricas.distribucionHabilidades);
      expect(body.datos.postulacionesPorEstado).toEqual(metricas.postulacionesPorEstado);
      expect(body.datos.actividadReciente).toEqual(metricas.actividadReciente);

      // Primera consulta: miss de caché, datos leídos de DynamoDB.
      expect(body.datos.metadatos).toBeDefined();
      expect(body.datos.metadatos.cache.desdeCache).toBe(false);
      expect(body.datos.metadatos.cache.origen).toBe('dynamodb');
      expect(body.datos.metadatos.cache.ttlSegundos).toBe(30);
      expect(body.datos.metadatos.actualizadoEn).toBeDefined();
    });

    it('debe repetir consultas con caché activa y no volver a consultar el repositorio (warm hit)', async () => {
      await dashboardHandler.obtenerResumenDashboard(eventoResumen, {});
      await dashboardHandler.obtenerResumenDashboard(eventoResumen, {});

      const cuerpoCaliente = JSON.parse(
        (await dashboardHandler.obtenerResumenDashboard(eventoResumen, {})).body,
      );
      expect(cuerpoCaliente.datos.colaboradoresActivos).toBe(metricas.colaboradoresActivos);
      expect(cuerpoCaliente.datos.metadatos.cache.desdeCache).toBe(true);
      expect(cuerpoCaliente.datos.metadatos.cache.origen).toBe('caché');

      // Cada método del repositorio se invocó una sola vez (primera petición en frío).
      expect(dashboardRepo.contarColaboradoresActivos).toHaveBeenCalledTimes(1);
      expect(dashboardRepo.contarProyectosPorEstado).toHaveBeenCalledTimes(1);
      expect(dashboardRepo.contarAsignacionesActivas).toHaveBeenCalledTimes(1);
      expect(dashboardRepo.obtenerDistribucionHabilidades).toHaveBeenCalledTimes(1);
      expect(dashboardRepo.obtenerPostulacionesPorEstado).toHaveBeenCalledTimes(1);
      expect(dashboardRepo.obtenerActividadReciente).toHaveBeenCalledTimes(1);
    });

    it('caso T26: tras una escritura e invalidación, la siguiente lectura obtiene el valor actualizado', async () => {
      // Lectura 1 con caché activa: versión 10
      dashboardRepo.contarColaboradoresActivos.mockResolvedValueOnce(10);
      const r1 = await dashboardHandler.obtenerColaboradoresActivos(eventoColaboradores, {});
      expect(JSON.parse(r1.body).datos.total).toBe(10);
      expect(JSON.parse(r1.body).datos.metadatos.cache.desdeCache).toBe(false);

      // Escritura en el repositorio: invalida la clave afectada (E06).
      cache.eliminarPorPrefijo('dashboard:colaboradores:');

      // Lectura 2: miss, el repositorio devuelve la versión actualizada (11).
      dashboardRepo.contarColaboradoresActivos.mockResolvedValueOnce(11);
      const r2 = await dashboardHandler.obtenerColaboradoresActivos(eventoColaboradores, {});
      expect(JSON.parse(r2.body).datos.total).toBe(11);
      expect(JSON.parse(r2.body).datos.metadatos.cache.desdeCache).toBe(false);
      expect(dashboardRepo.contarColaboradoresActivos).toHaveBeenCalledTimes(2);
    });

    it('debe capturar errores de base de datos y retornar 500', async () => {
      dashboardRepo.contarColaboradoresActivos.mockRejectedValue(new Error('DynamoDB timeout'));

      const result = await dashboardHandler.obtenerResumenDashboard(eventoResumen, {});
      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.mensaje).toBe('Error interno del servidor');
    });
  });

  describe('obtenerColaboradoresActivos', () => {
    it('debe retornar el total de colaboradores activos con metadatos de caché', async () => {
      dashboardRepo.contarColaboradoresActivos.mockResolvedValue(15);

      const result = await dashboardHandler.obtenerColaboradoresActivos(eventoColaboradores, {});
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.datos.total).toBe(15);
      expect(body.datos.metadatos.cache.desdeCache).toBe(false);
      expect(body.datos.metadatos.cache.origen).toBe('dynamodb');

      // Segunda petición idéntica: hit de caché, repositorio no vuelve a invocarse.
      const result2 = await dashboardHandler.obtenerColaboradoresActivos(eventoColaboradores, {});
      const body2 = JSON.parse(result2.body);
      expect(body2.datos.total).toBe(15);
      expect(body2.datos.metadatos.cache.desdeCache).toBe(true);
      expect(body2.datos.metadatos.cache.origen).toBe('caché');
      expect(dashboardRepo.contarColaboradoresActivos).toHaveBeenCalledTimes(1);
    });

    it('debe capturar errores de base de datos y retornar 500', async () => {
      dashboardRepo.contarColaboradoresActivos.mockRejectedValue(new Error('DynamoDB timeout'));

      const result = await dashboardHandler.obtenerColaboradoresActivos(eventoColaboradores, {});
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.mensaje).toBe('Error interno del servidor');
    });
  });

  describe('obtenerActividadReciente', () => {
    beforeEach(() => {
      dashboardRepo.obtenerActividadReciente.mockResolvedValue([
        {
          tipo: 'proyecto',
          id: 'p1',
          nombre: 'Proyecto X',
          fecha: '2026-11-10T10:00:00Z',
          estado: 'ACTIVO',
        },
      ]);
    });

    it('genera claves de caché independientes por parámetros de consulta', async () => {
      const eventoA = { ...eventoActividad, queryStringParameters: { dias: 7, limite: 50 } };
      const eventoB = { ...eventoActividad, queryStringParameters: { dias: 30, limite: 100 } };

      await dashboardHandler.obtenerActividadReciente(eventoA, {});
      await dashboardHandler.obtenerActividadReciente(eventoB, {});
      await dashboardHandler.obtenerActividadReciente(eventoA, {});

      // Distintos parámetros generan claves distintas: eventoA se consulta dos veces (miss + hit)
      // y eventoB una vez (miss). Total de invocaciones al repositorio: 2.
      expect(dashboardRepo.obtenerActividadReciente).toHaveBeenCalledTimes(2);
      expect(dashboardRepo.obtenerActividadReciente).toHaveBeenCalledWith({ dias: 7, limite: 50 });
      expect(dashboardRepo.obtenerActividadReciente).toHaveBeenCalledWith({ dias: 30, limite: 100 });

      const cuerpoA = JSON.parse(
        (await dashboardHandler.obtenerActividadReciente(eventoA, {})).body,
      );
      expect(cuerpoA.datos.total).toBe(1);
      expect(cuerpoA.datos.metadatos.cache.desdeCache).toBe(true);
    });
  });
});