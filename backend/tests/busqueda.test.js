const busquedaHandler = require('../src/functions/busqueda/handler');
const colaboradorHabilidadRepository = require('../src/repositories/colaborador-habilidad.repository');
const colaboradoresRepository = require('../src/repositories/colaboradores.repository');
const usuariosRepository = require('../src/repositories/usuarios.repository');
const proyectoHabilidadRepository = require('../src/repositories/proyecto-habilidad.repository');

jest.mock('../src/repositories/colaborador-habilidad.repository');
jest.mock('../src/repositories/colaboradores.repository');
jest.mock('../src/repositories/usuarios.repository');
jest.mock('../src/repositories/proyecto-habilidad.repository');
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
      usuariosRepository.obtenerPorId.mockResolvedValue(null);
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
            disponibilidad: 'DISPONIBLE',
            dedicacionReservada: 0,
          };
        }
        if (id === 'colab_2') {
          return {
            colaboradorId: 'colab_2',
            usuarioId: 'usr_2',
            cargoId: 'crg_2',
            rolProfesional: 'Frontend Dev',
            estado: 'ACTIVO',
            disponibilidad: 'DISPONIBLE',
            dedicacionReservada: 0,
          };
        }
        return null;
      });

      // Mock de usuarios vinculados (ambos activos)
      usuariosRepository.obtenerPorId.mockImplementation(async (id) => {
        if (id === 'usr_1') return { usuarioId: 'usr_1', estado: 'ACTIVO' };
        if (id === 'usr_2') return { usuarioId: 'usr_2', estado: 'ACTIVO' };
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

      usuariosRepository.obtenerPorId.mockResolvedValue(null);

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

    it('debe buscar candidatos por proyectoId usando requisitos del repositorio', async () => {
      proyectoHabilidadRepository.consultarHabilidadesProyecto.mockResolvedValue([
        { habilidadId: 'hab_react', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 3 },
        { habilidadId: 'hab_sql', nivelMinimo: 'MID', esObligatoria: true, peso: 1 },
      ]);

      colaboradorHabilidadRepository.listarPorHabilidad
        .mockResolvedValueOnce({
          items: [{ colaboradorId: 'col_1', habilidadId: 'hab_react', nivel: 'SENIOR', anosExperiencia: 5 }],
          lastKey: null,
        })
        .mockResolvedValueOnce({
          items: [{ colaboradorId: 'col_1', habilidadId: 'hab_sql', nivel: 'MID', anosExperiencia: 3 }],
          lastKey: null,
        });

      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'col_1', usuarioId: 'usr_1', cargoId: 'crg_1',
        rolProfesional: 'Dev', estado: 'ACTIVO', dedicacionReservada: 0,
      });
      usuariosRepository.obtenerPorId.mockResolvedValue({ usuarioId: 'usr_1', estado: 'ACTIVO' });

      const event = {
        queryStringParameters: { proyectoId: 'proj_1', considerarDisponibilidad: 'true' },
      };

      const result = await busquedaHandler.buscarCandidatos(event, {});
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.datos.candidatos.length).toBe(1);
      expect(body.datos.candidatos[0].colaboradorId).toBe('col_1');
      expect(body.datos.candidatos[0].puntuacion).toBe(100);
      expect(body.datos.candidatos[0].elegible).toBe(true);
      expect(body.datos.criterios.tipo).toBe('proyecto');
      expect(body.datos.criterios.proyectoId).toBe('proj_1');
    });

    it('debe excluir colaborador cuando incumple habilidad obligatoria del proyecto', async () => {
      proyectoHabilidadRepository.consultarHabilidadesProyecto.mockResolvedValue([
        { habilidadId: 'hab_react', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 3 },
        { habilidadId: 'hab_sql', nivelMinimo: 'MID', esObligatoria: true, peso: 1 },
      ]);

      colaboradorHabilidadRepository.listarPorHabilidad
        .mockResolvedValueOnce({
          items: [{ colaboradorId: 'col_1', habilidadId: 'hab_react', nivel: 'JUNIOR', anosExperiencia: 1 }],
          lastKey: null,
        })
        .mockResolvedValueOnce({
          items: [{ colaboradorId: 'col_1', habilidadId: 'hab_sql', nivel: 'MID', anosExperiencia: 3 }],
          lastKey: null,
        });

      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'col_1', usuarioId: 'usr_1', cargoId: 'crg_1',
        rolProfesional: 'Dev', estado: 'ACTIVO', dedicacionReservada: 0,
      });
      usuariosRepository.obtenerPorId.mockResolvedValue({ usuarioId: 'usr_1', estado: 'ACTIVO' });

      const event = { queryStringParameters: { proyectoId: 'proj_1' } };
      const result = await busquedaHandler.buscarCandidatos(event, {});

      const body = JSON.parse(result.body);
      expect(body.datos.candidatos.length).toBe(0);
    });

    it('debe evitar resultados duplicados cuando un colaborador tiene múltiples habilidades', async () => {
      colaboradorHabilidadRepository.listarPorHabilidad
        .mockResolvedValueOnce({
          items: [
            { colaboradorId: 'col_1', habilidadId: 'hab_react', nivel: 'SENIOR', anosExperiencia: 5 },
            { colaboradorId: 'col_1', habilidadId: 'hab_sql', nivel: 'SENIOR', anosExperiencia: 3 },
          ],
          lastKey: null,
        })
        .mockResolvedValueOnce({
          items: [{ colaboradorId: 'col_1', habilidadId: 'hab_sql', nivel: 'SENIOR', anosExperiencia: 3 }],
          lastKey: null,
        });

      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'col_1', usuarioId: 'usr_1', cargoId: 'crg_1',
        rolProfesional: 'Dev', estado: 'ACTIVO', dedicacionReservada: 0,
      });
      usuariosRepository.obtenerPorId.mockResolvedValue({ usuarioId: 'usr_1', estado: 'ACTIVO' });

      const event = {
        queryStringParameters: {
          habilidades: 'hab_react,hab_sql',
          nivelMinimo: 'MID',
          tipoCoincidencia: 'todas',
        },
      };

      const result = await busquedaHandler.buscarCandidatos(event, {});
      const body = JSON.parse(result.body);
      expect(body.datos.candidatos.length).toBe(1);
      expect(body.datos.candidatos[0].colaboradorId).toBe('col_1');
    });

    it('evalúa candidatos sin coincidencias cuando todos los requisitos son opcionales', async () => {
      proyectoHabilidadRepository.consultarHabilidadesProyecto.mockResolvedValue([
        { habilidadId: 'h1', nivelMinimo: 'JUNIOR', esObligatoria: false, peso: 2 },
        { habilidadId: 'h2', nivelMinimo: 'MID', esObligatoria: false, peso: 1 },
      ]);
      colaboradorHabilidadRepository.listarPorHabilidad.mockResolvedValue({ items: [], lastKey: null });
      colaboradoresRepository.listar.mockResolvedValue({ items: [{ colaboradorId: 'c1' }], lastKey: null });
      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'c1', usuarioId: 'u1', estado: 'ACTIVO', dedicacionReservada: 0,
      });
      usuariosRepository.obtenerPorId.mockResolvedValue({ usuarioId: 'u1', estado: 'ACTIVO' });
      const respuesta = await busquedaHandler.buscarCandidatos({
        queryStringParameters: { proyectoId: 'p1' },
      }, {});
      expect(respuesta.statusCode).toBe(200);
      const [candidato] = JSON.parse(respuesta.body).datos.candidatos;
      expect(candidato).toMatchObject({ colaboradorId: 'c1', elegible: true, puntuacion: 0 });
      expect(candidato.habilidadesFaltantes).toHaveLength(2);
    });

    it('excluye colaboradores cuya cuenta vinculada no puede verificarse', async () => {
      colaboradorHabilidadRepository.listarPorHabilidad.mockResolvedValue({
        items: [{ colaboradorId: 'c1', habilidadId: 'h1', nivel: 'SENIOR' }], lastKey: null,
      });
      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'c1', usuarioId: 'u1', estado: 'ACTIVO', dedicacionReservada: 0,
      });
      usuariosRepository.obtenerPorId.mockResolvedValue(null);
      const respuesta = await busquedaHandler.buscarCandidatos({
        queryStringParameters: { habilidades: 'h1' },
      }, {});
      expect(respuesta.statusCode).toBe(200);
      expect(JSON.parse(respuesta.body).datos.candidatos).toEqual([]);
    });

    it('debe retornar 404 cuando el proyecto no tiene habilidades requeridas', async () => {
      proyectoHabilidadRepository.consultarHabilidadesProyecto.mockResolvedValue([]);

      const event = { queryStringParameters: { proyectoId: 'proj_vacio' } };
      const result = await busquedaHandler.buscarCandidatos(event, {});
      expect(result.statusCode).toBe(404);
    });

    it('debe retornar puntuación ponderada según pesos del proyecto', async () => {
      proyectoHabilidadRepository.consultarHabilidadesProyecto.mockResolvedValue([
        { habilidadId: 'hab_react', nivelMinimo: 'JUNIOR', esObligatoria: true, peso: 5 },
        { habilidadId: 'hab_sql', nivelMinimo: 'JUNIOR', esObligatoria: false, peso: 1 },
      ]);

      colaboradorHabilidadRepository.listarPorHabilidad
        .mockResolvedValueOnce({
          items: [{ colaboradorId: 'col_1', habilidadId: 'hab_react', nivel: 'SENIOR', anosExperiencia: 5 }],
          lastKey: null,
        })
        .mockResolvedValueOnce({
          items: [],
          lastKey: null,
        });

      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'col_1', usuarioId: 'usr_1', cargoId: 'crg_1',
        rolProfesional: 'Dev', estado: 'ACTIVO', dedicacionReservada: 0,
      });
      usuariosRepository.obtenerPorId.mockResolvedValue({ usuarioId: 'usr_1', estado: 'ACTIVO' });

      const event = { queryStringParameters: { proyectoId: 'proj_1' } };
      const result = await busquedaHandler.buscarCandidatos(event, {});

      const body = JSON.parse(result.body);
      expect(body.datos.candidatos.length).toBe(1);
      // hab_react cumplido (peso 5), hab_sql faltante opcional (peso 1): 5/6 = 83.33 -> 83
      expect(body.datos.candidatos[0].puntuacion).toBe(83);
      expect(body.datos.candidatos[0].elegible).toBe(true);
    });

    it('limita a cuatro las lecturas paralelas y evita repetir habilidades', async () => {
      let enVuelo = 0;
      let maximo = 0;
      colaboradorHabilidadRepository.listarPorHabilidad.mockImplementation(async () => {
        enVuelo += 1;
        maximo = Math.max(maximo, enVuelo);
        await Promise.resolve();
        enVuelo -= 1;
        return { items: [], lastKey: null };
      });
      const respuesta = await busquedaHandler.buscarCandidatos({
        queryStringParameters: { habilidades: 'h1,h1,h2,h3,h4,h5' },
      }, {});
      expect(respuesta.statusCode).toBe(200);
      expect(colaboradorHabilidadRepository.listarPorHabilidad).toHaveBeenCalledTimes(5);
      expect(maximo).toBe(4);
      expect(JSON.parse(respuesta.body).datos.candidatos).toEqual([]);
    });
  });
});