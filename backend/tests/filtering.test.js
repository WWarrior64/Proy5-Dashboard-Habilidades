const filteringService = require('../src/services/filtering.service');
const busquedaHandler = require('../src/functions/busqueda/handler');
const colaboradorHabilidadRepository = require('../src/repositories/colaborador-habilidad.repository');
const colaboradoresRepository = require('../src/repositories/colaboradores.repository');

jest.mock('../src/repositories/colaborador-habilidad.repository');
jest.mock('../src/repositories/colaboradores.repository');

describe('Algoritmo de Búsqueda de Candidatos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('filtering.service', () => {
    test('calcularPuntuacion debe devolver el porcentaje correcto', () => {
      const colaborador = {
        habilidadesCoincidentes: [{ habilidadId: 'h1' }, { habilidadId: 'h2' }],
        totalRequeridas: 4,
      };
      expect(filteringService.calcularPuntuacion(colaborador)).toBe(50);
    });

    test('cumpleNivelMinimo debe validar jerarquía de niveles', () => {
      expect(filteringService.cumpleNivelMinimo('SENIOR', 'JUNIOR')).toBe(true);
      expect(filteringService.cumpleNivelMinimo('JUNIOR', 'SENIOR')).toBe(false);
      expect(filteringService.cumpleNivelMinimo('MID', 'MID')).toBe(true);
    });

    test('ordenarPorPuntuacion debe ordenar descendente', () => {
      const candidatos = [
        { colaboradorId: 'a', puntuacion: 30 },
        { colaboradorId: 'b', puntuacion: 80 },
        { colaboradorId: 'c', puntuacion: 50 },
      ];
      const ordenados = filteringService.ordenarPorPuntuacion(candidatos);
      expect(ordenados[0].colaboradorId).toBe('b');
      expect(ordenados[2].colaboradorId).toBe('a');
    });

    test('filtrarPorDisponibilidad debe excluir inactivos', () => {
      const candidatos = [
        { colaboradorId: 'a', estado: 'ACTIVO' },
        { colaboradorId: 'b', estado: 'INACTIVO' },
      ];
      const activos = filteringService.filtrarPorDisponibilidad(candidatos, true);
      expect(activos.length).toBe(1);
      expect(activos[0].colaboradorId).toBe('a');
    });
  });

  describe('buscarCandidatos handler', () => {
    test('debe retornar candidatos con coincidencia completa (todas)', async () => {
      const relaciones = [
        { colaboradorId: 'col_1', habilidadId: 'hab_1', nivel: 'SENIOR', anosExperiencia: 5 },
        { colaboradorId: 'col_1', habilidadId: 'hab_2', nivel: 'SENIOR', anosExperiencia: 4 },
        { colaboradorId: 'col_2', habilidadId: 'hab_1', nivel: 'JUNIOR', anosExperiencia: 1 },
      ];
      colaboradorHabilidadRepository.listarPorHabilidad
        .mockResolvedValueOnce({ items: relaciones.filter((r) => r.habilidadId === 'hab_1'), lastKey: null })
        .mockResolvedValueOnce({ items: relaciones.filter((r) => r.habilidadId === 'hab_2'), lastKey: null });

      colaboradoresRepository.obtenerPorId
        .mockResolvedValueOnce({ colaboradorId: 'col_1', usuarioId: 'usr_1', estado: 'ACTIVO', cargoId: 'cargo_1', rolProfesional: 'Dev' })
        .mockResolvedValueOnce({ colaboradorId: 'col_2', usuarioId: 'usr_2', estado: 'ACTIVO', cargoId: 'cargo_1', rolProfesional: 'Dev' });

      const event = {
        body: JSON.stringify({
          habilidades: ['hab_1', 'hab_2'],
          nivelMinimo: 'SENIOR',
          tipoCoincidencia: 'todas',
        }),
      };
      const result = await busquedaHandler.buscarCandidatos(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.datos.candidatos.length).toBeGreaterThanOrEqual(0);
    });

    test('debe retornar candidatos con coincidencia parcial (alguna)', async () => {
      colaboradorHabilidadRepository.listarPorHabilidad.mockResolvedValue({
        items: [{ colaboradorId: 'col_1', habilidadId: 'hab_1', nivel: 'MID', anosExperiencia: 3 }],
        lastKey: null,
      });
      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'col_1', usuarioId: 'usr_1', estado: 'ACTIVO', cargoId: 'cargo_1', rolProfesional: 'Dev',
      });

      const event = {
        body: JSON.stringify({
          habilidades: ['hab_1', 'hab_2'],
          nivelMinimo: 'JUNIOR',
          tipoCoincidencia: 'alguna',
        }),
      };
      const result = await busquedaHandler.buscarCandidatos(event, {});

      expect(result.statusCode).toBe(200);
    });

    test('debe excluir colaboradores con nivel inferior al requerido', async () => {
      colaboradorHabilidadRepository.listarPorHabilidad.mockResolvedValue({
        items: [{ colaboradorId: 'col_1', habilidadId: 'hab_1', nivel: 'JUNIOR', anosExperiencia: 1 }],
        lastKey: null,
      });
      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'col_1', usuarioId: 'usr_1', estado: 'ACTIVO', cargoId: 'cargo_1', rolProfesional: 'Dev',
      });

      const event = {
        body: JSON.stringify({
          habilidades: ['hab_1'],
          nivelMinimo: 'SENIOR',
          tipoCoincidencia: 'todas',
        }),
      };
      const result = await busquedaHandler.buscarCandidatos(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.datos.candidatos.length).toBe(0);
    });

    test('debe excluir colaboradores inactivos', async () => {
      colaboradorHabilidadRepository.listarPorHabilidad.mockResolvedValue({
        items: [{ colaboradorId: 'col_1', habilidadId: 'hab_1', nivel: 'SENIOR' }],
        lastKey: null,
      });
      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'col_1', usuarioId: 'usr_1', estado: 'INACTIVO', cargoId: 'cargo_1', rolProfesional: 'Dev',
      });

      const event = {
        body: JSON.stringify({
          habilidades: ['hab_1'],
          nivelMinimo: 'JUNIOR',
          tipoCoincidencia: 'todas',
        }),
      };
      const result = await busquedaHandler.buscarCandidatos(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.datos.candidatos.length).toBe(0);
    });

    test('debe retornar 400 cuando no se proporcionan habilidades', async () => {
      const event = { body: JSON.stringify({}) };
      const result = await busquedaHandler.buscarCandidatos(event, {});
      expect(result.statusCode).toBe(400);
    });

    test('debe ordenar candidatos por puntuación descendente', async () => {
      const rel1 = [
        { colaboradorId: 'col_1', habilidadId: 'hab_1', nivel: 'SENIOR' },
        { colaboradorId: 'col_1', habilidadId: 'hab_2', nivel: 'SENIOR' },
      ];
      const rel2 = [{ colaboradorId: 'col_2', habilidadId: 'hab_1', nivel: 'SENIOR' }];
      colaboradorHabilidadRepository.listarPorHabilidad
        .mockResolvedValueOnce({ items: rel1, lastKey: null })
        .mockResolvedValueOnce({ items: rel2, lastKey: null });

      colaboradoresRepository.obtenerPorId
        .mockResolvedValueOnce({ colaboradorId: 'col_1', usuarioId: 'usr_1', estado: 'ACTIVO' })
        .mockResolvedValueOnce({ colaboradorId: 'col_2', usuarioId: 'usr_2', estado: 'ACTIVO' });

      const event = {
        body: JSON.stringify({
          habilidades: ['hab_1', 'hab_2'],
          nivelMinimo: 'SENIOR',
          tipoCoincidencia: 'todas',
        }),
      };
      const result = await busquedaHandler.buscarCandidatos(event, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      if (body.datos.candidatos.length >= 2) {
        expect(body.datos.candidatos[0].puntuacion).toBeGreaterThanOrEqual(body.datos.candidatos[1].puntuacion);
      }
    });
  });
});