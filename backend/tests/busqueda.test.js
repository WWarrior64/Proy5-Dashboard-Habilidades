const busquedaHandler = require('../src/functions/busqueda/handler');
const colaboradorHabilidadRepository = require('../src/repositories/colaborador-habilidad.repository');
const colaboradoresRepository = require('../src/repositories/colaboradores.repository');

jest.mock('../src/repositories/colaborador-habilidad.repository');
jest.mock('../src/repositories/colaboradores.repository');
jest.mock('../../repositories/proyectos.repository', () => ({
  listarProyectos: jest.fn(),
}), { virtual: true });
jest.mock('../../repositories/habilidades.repository', () => ({
  listar: jest.fn(),
}), { virtual: true });

describe('Módulo de Búsqueda de Candidatos - Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buscarCandidatos', () => {
    it('debe retornar 400 si no se envían habilidades en la consulta', async () => {
      const event = {
        queryStringParameters: {},
      };

      const result = await busquedaHandler.buscarCandidatos(event, {});
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.mensaje).toMatch(/habilidad/i);
    });

    it('debe buscar candidatos por habilidades y calcular coincidencia y disponibilidad', async () => {
      // Mock con la estructura { items: [...], lastKey: null } que espera el handler
      colaboradorHabilidadRepository.listarPorHabilidad.mockResolvedValue({
        items: [
          {
            colaboradorId: 'colab_1',
            habilidadId: 'hab_react',
            nivel: 'SENIOR',
            anosExperiencia: 4,
          },
          {
            colaboradorId: 'colab_2',
            habilidadId: 'hab_react',
            nivel: 'JUNIOR',
            anosExperiencia: 1,
          },
        ],
        lastKey: null,
      });

      colaboradoresRepository.obtenerPorId.mockImplementation(async (id) => {
        if (id === 'colab_1') {
          return {
            colaboradorId: 'colab_1',
            usuarioId: 'usr_1',
            cargoId: 'crg_1',
            rolProfesional: 'Fullstack Developer',
            estado: 'ACTIVO',
          };
        }
        if (id === 'colab_2') {
          return {
            colaboradorId: 'colab_2',
            usuarioId: 'usr_2',
            cargoId: 'crg_2',
            rolProfesional: 'Frontend Dev',
            estado: 'ACTIVO',
          };
        }
        return null;
      });

      const event = {
        queryStringParameters: {
          habilidades: 'hab_react',
          nivelMinimo: 'MID',
          tipoCoincidencia: 'alguna',
          considerarDisponibilidad: 'true',
        },
      };

      const result = await busquedaHandler.buscarCandidatos(event, {});
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.datos).toBeDefined();
      expect(Array.isArray(body.datos.candidatos)).toBe(true);
      expect(body.datos.candidatos.length).toBeGreaterThan(0);
      expect(body.datos.candidatos[0].colaboradorId).toBe('colab_1');
      expect(body.datos.candidatos[0].puntuacion).toBe(100);
    });

    it('debe retornar lista vacía con 200 cuando no hay coincidencias', async () => {
      colaboradorHabilidadRepository.listarPorHabilidad.mockResolvedValue({
        items: [],
        lastKey: null,
      });

      const event = {
        queryStringParameters: {
          habilidades: 'hab_inexistente',
        },
      };

      const result = await busquedaHandler.buscarCandidatos(event, {});
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.datos.candidatos).toHaveLength(0);
    });
  });
});