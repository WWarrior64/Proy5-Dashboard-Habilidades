const colaboradoresHandler = require('../src/functions/colaboradores/handler');
const colaboradoresRepository = require('../src/repositories/colaboradores.repository');

jest.mock('../src/repositories/colaboradores.repository');

describe('Módulo de Colaboradores - Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('crearColaborador', () => {
    test('debe crear un colaborador válido', async () => {
      const colaboradorMock = {
        colaboradorId: 'col_1',
        usuarioId: 'usr_1',
        cargoId: 'cargo_1',
        rolProfesional: 'Desarrollador',
        estado: 'ACTIVO',
      };
      colaboradoresRepository.crear.mockResolvedValue(colaboradorMock);
      const event = { body: JSON.stringify(colaboradorMock) };
      const result = await colaboradoresHandler.crearColaborador(event, {});
      expect(result.statusCode).toBe(201);
      expect(colaboradoresRepository.crear).toHaveBeenCalledWith(colaboradorMock);
    });

    test('debe retornar 400 cuando faltan campos requeridos', async () => {
      const event = { body: JSON.stringify({ colaboradorId: 'col_1' }) };
      const result = await colaboradoresHandler.crearColaborador(event, {});
      expect(result.statusCode).toBe(400);
    });

    test('debe retornar 409 cuando el usuario ya tiene un perfil de colaborador', async () => {
      const error = new Error('El usuario ya tiene un perfil de colaborador asociado');
      error.codigo = 409;
      error.codigoError = 'CONFLICT';
      colaboradoresRepository.crear.mockRejectedValue(error);
      const event = {
        body: JSON.stringify({
          colaboradorId: 'col_2', usuarioId: 'usr_1', cargoId: 'cargo_1', rolProfesional: 'Dev',
        }),
      };
      const result = await colaboradoresHandler.crearColaborador(event, {});
      expect(result.statusCode).toBe(409);
    });

    test('debe retornar 400 cuando el cargo está inactivo', async () => {
      const error = new Error('No se puede asignar un colaborador a un cargo inactivo');
      error.codigo = 400;
      error.codigoError = 'VALIDATION_ERROR';
      colaboradoresRepository.crear.mockRejectedValue(error);
      const event = {
        body: JSON.stringify({
          colaboradorId: 'col_1', usuarioId: 'usr_1', cargoId: 'cargo_inactivo', rolProfesional: 'Dev',
        }),
      };
      const result = await colaboradoresHandler.crearColaborador(event, {});
      expect(result.statusCode).toBe(400);
    });
  });

  describe('listarColaboradores', () => {
    test('debe listar colaboradores con filtros', async () => {
      colaboradoresRepository.listar.mockResolvedValue({ items: [{ colaboradorId: 'col_1' }], lastKey: null });
      const event = { queryStringParameters: { estado: 'ACTIVO', cargoId: 'cargo_1' } };
      const result = await colaboradoresHandler.listarColaboradores(event, {});
      expect(result.statusCode).toBe(200);
      expect(colaboradoresRepository.listar).toHaveBeenCalledWith({ estado: 'ACTIVO', cargoId: 'cargo_1' });
    });
  });

  describe('obtenerColaborador', () => {
    test('debe retornar un colaborador por su ID', async () => {
      colaboradoresRepository.obtenerPorId.mockResolvedValue({ colaboradorId: 'col_1', usuarioId: 'usr_1' });
      const event = { pathParameters: { colaboradorId: 'col_1' } };
      const result = await colaboradoresHandler.obtenerColaborador(event, {});
      expect(result.statusCode).toBe(200);
      expect(colaboradoresRepository.obtenerPorId).toHaveBeenCalledWith('col_1');
    });

    test('debe retornar 404 cuando el colaborador no existe', async () => {
      colaboradoresRepository.obtenerPorId.mockResolvedValue(null);
      const event = { pathParameters: { colaboradorId: 'inexistente' } };
      const result = await colaboradoresHandler.obtenerColaborador(event, {});
      expect(result.statusCode).toBe(404);
    });
  });

  describe('actualizarColaborador', () => {
    test('debe actualizar la información profesional de un colaborador', async () => {
      colaboradoresRepository.actualizar.mockResolvedValue({ colaboradorId: 'col_1', cargoId: 'cargo_2' });
      const event = {
        pathParameters: { colaboradorId: 'col_1' },
        body: JSON.stringify({ cargoId: 'cargo_2' }),
      };
      const result = await colaboradoresHandler.actualizarColaborador(event, {});
      expect(result.statusCode).toBe(200);
      expect(colaboradoresRepository.actualizar).toHaveBeenCalledWith('col_1', { cargoId: 'cargo_2' });
    });
  });

  describe('darBajaColaborador', () => {
    test('debe dar de baja un colaborador cambiando estado a INACTIVO', async () => {
      colaboradoresRepository.darBaja.mockResolvedValue({ colaboradorId: 'col_1', estado: 'INACTIVO' });
      const event = { pathParameters: { colaboradorId: 'col_1' } };
      const result = await colaboradoresHandler.darBajaColaborador(event, {});
      expect(result.statusCode).toBe(200);
      expect(colaboradoresRepository.darBaja).toHaveBeenCalledWith('col_1');
    });
  });
});