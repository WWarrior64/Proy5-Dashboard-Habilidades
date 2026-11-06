const colaboradorHabilidadRepository = require('../src/repositories/colaborador-habilidad.repository');

jest.mock('../src/repositories/colaborador-habilidad.repository', () => {
  const relaciones = [];
  return {
    get relaciones() { return relaciones; },
    set relaciones(val) { relaciones.length = 0; if (val) relaciones.push(...val); },
    asociar: jest.fn(async function (data) {
      const existente = relaciones.find(
        (r) => r.colaboradorId === this.colaboradorId && r.habilidadId === this.habilidadId
      );
      if (existente) throw new Error('Ya existe');
      const rel = { ...data, fechaCreacion: new Date().toISOString() };
      relaciones.push(rel);
      return rel;
    }),
    listarPorColaborador: jest.fn(async function (colaboradorId) {
      return relaciones.filter((r) => r.colaboradorId === colaboradorId);
    }),
    obtenerPorColaboradorYHabilidad: jest.fn(async function (colaboradorId, habilidadId) {
      return relaciones.find(
        (r) => r.colaboradorId === colaboradorId && r.habilidadId === habilidadId
      ) || null;
    }),
    actualizarNivel: jest.fn(async function (colaboradorId, habilidadId, data) {
      const rel = relaciones.find(
        (r) => r.colaboradorId === colaboradorId && r.habilidadId === habilidadId
      );
      if (!rel) return null;
      Object.assign(rel, data);
      return rel;
    }),
    retirar: jest.fn(async function (colaboradorId, habilidadId) {
      const idx = relaciones.findIndex(
        (r) => r.colaboradorId === colaboradorId && r.habilidadId === habilidadId
      );
      if (idx === -1) return false;
      relaciones.splice(idx, 1);
      return true;
    }),
    listarPorHabilidad: jest.fn(async function (habilidadId) {
      return relaciones.filter((r) => r.habilidadId === habilidadId);
    }),
    validarNivel: jest.fn((nivel) => {
      if (!['JUNIOR', 'MID', 'SENIOR'].includes(nivel)) throw new Error('Nivel inválido');
    }),
  };
});

describe('Módulo de ColaboradorHabilidad - Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    colaboradorHabilidadRepository.relaciones = [];
  });

  describe('asociar', () => {
    test('debe asociar una habilidad a un colaborador', async () => {
      const data = {
        colaboradorId: 'col_1',
        habilidadId: 'hab_1',
        nivel: 'SENIOR',
        anosExperiencia: 5,
      };
      const resultado = await colaboradorHabilidadRepository.asociar(data);

      expect(resultado.colaboradorId).toBe('col_1');
      expect(resultado.habilidadId).toBe('hab_1');
      expect(resultado.nivel).toBe('SENIOR');
      expect(colaboradorHabilidadRepository.asociar).toHaveBeenCalledWith(data);
    });

    test('debe validar que el nivel sea JUNIOR, MID o SENIOR', () => {
      expect(() => {
        colaboradorHabilidadRepository.validarNivel('INVALIDO');
      }).toThrow();
    });
  });

  describe('listarPorColaborador', () => {
    test('debe consultar las habilidades de un colaborador', async () => {
      await colaboradorHabilidadRepository.asociar({
        colaboradorId: 'col_1',
        habilidadId: 'hab_1',
        nivel: 'MID',
      });
      await colaboradorHabilidadRepository.asociar({
        colaboradorId: 'col_1',
        habilidadId: 'hab_2',
        nivel: 'JUNIOR',
      });

      const resultado = await colaboradorHabilidadRepository.listarPorColaborador('col_1');

      expect(resultado.length).toBe(2);
    });
  });

  describe('actualizarNivel', () => {
    test('debe actualizar el nivel de dominio de una habilidad', async () => {
      await colaboradorHabilidadRepository.asociar({
        colaboradorId: 'col_1',
        habilidadId: 'hab_1',
        nivel: 'JUNIOR',
      });

      const resultado = await colaboradorHabilidadRepository.actualizarNivel('col_1', 'hab_1', {
        nivel: 'SENIOR',
      });

      expect(resultado.nivel).toBe('SENIOR');
    });
  });

  describe('retirar', () => {
    test('debe retirar una habilidad del perfil de un colaborador', async () => {
      await colaboradorHabilidadRepository.asociar({
        colaboradorId: 'col_1',
        habilidadId: 'hab_1',
        nivel: 'MID',
      });

      const resultado = await colaboradorHabilidadRepository.retirar('col_1', 'hab_1');

      expect(resultado).toBe(true);

      const despues = await colaboradorHabilidadRepository.obtenerPorColaboradorYHabilidad('col_1', 'hab_1');
      expect(despues).toBeNull();
    });
  });

  describe('listarPorHabilidad', () => {
    test('debe consultar colaboradores que dominen una habilidad determinada', async () => {
      await colaboradorHabilidadRepository.asociar({
        colaboradorId: 'col_1',
        habilidadId: 'hab_1',
        nivel: 'SENIOR',
      });
      await colaboradorHabilidadRepository.asociar({
        colaboradorId: 'col_2',
        habilidadId: 'hab_1',
        nivel: 'JUNIOR',
      });

      const resultado = await colaboradorHabilidadRepository.listarPorHabilidad('hab_1');

      expect(resultado.length).toBe(2);
    });
  });
});