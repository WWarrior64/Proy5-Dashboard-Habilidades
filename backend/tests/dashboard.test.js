const dashboardHandler = require('../src/functions/dashboard/handler');
const dashboardRepo = require('../src/repositories/dashboard.repository');

jest.mock('../src/repositories/dashboard.repository');

describe('Módulo de Dashboard - Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('obtenerResumenDashboard', () => {
    it('debe retornar métricas consolidadas con status 200', async () => {
      dashboardRepo.contarColaboradoresActivos.mockResolvedValue(12);
      dashboardRepo.contarProyectosPorEstado.mockResolvedValue({ ACTIVO: 4, COMPLETADO: 2 });
      dashboardRepo.contarAsignacionesActivas.mockResolvedValue(8);
      dashboardRepo.obtenerDistribucionHabilidades.mockResolvedValue({ frontend: 5, backend: 7 });
      dashboardRepo.obtenerPostulacionesPorEstado.mockResolvedValue({ PENDIENTE: 3, ACEPTADA: 5 });
      dashboardRepo.obtenerActividadReciente.mockResolvedValue([
        { tipo: 'POSTULACION_CREADA', fecha: '2026-11-10T10:00:00Z' },
      ]);

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/dashboard/resumen',
      };

      const result = await dashboardHandler.obtenerResumenDashboard(event, {});
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.datos).toBeDefined();
      expect(body.datos).toEqual({
        colaboradoresActivos: 12,
        proyectosPorEstado: { ACTIVO: 4, COMPLETADO: 2 },
        asignacionesActivas: 8,
        distribucionHabilidades: { frontend: 5, backend: 7 },
        postulacionesPorEstado: { PENDIENTE: 3, ACEPTADA: 5 },
        actividadReciente: [
          { tipo: 'POSTULACION_CREADA', fecha: '2026-11-10T10:00:00Z' },
        ],
      });
    });

    it('debe capturar errores de base de datos y retornar 500', async () => {
      dashboardRepo.contarColaboradoresActivos.mockRejectedValue(new Error('DynamoDB timeout'));

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/dashboard/resumen',
      };

      const result = await dashboardHandler.obtenerResumenDashboard(event, {});
      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.mensaje).toBe('Error interno del servidor');
    });
  });

  describe('obtenerColaboradoresActivos', () => {
    it('debe retornar el total de colaboradores activos', async () => {
      dashboardRepo.contarColaboradoresActivos.mockResolvedValue(15);

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/dashboard/colaboradores',
      };

      const result = await dashboardHandler.obtenerColaboradoresActivos(event, {});
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.datos).toEqual({ total: 15 });
    });
  });
});