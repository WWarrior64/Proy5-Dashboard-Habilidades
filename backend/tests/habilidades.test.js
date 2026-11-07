const habilidadesHandler = require('../src/functions/habilidades/handler');
const habilidadesRepository = require('../src/repositories/habilidades.repository');

jest.mock('../src/repositories/habilidades.repository');

describe('Módulo de Habilidades - Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('crearHabilidad', () => {
    test('debe crear una habilidad válida', async () => {
      const habilidadMock = {
        habilidadId: 'hab_1',
        nombre: 'JavaScript',
        categoria: 'Programación',
        estado: 'ACTIVO',
      };
      habilidadesRepository.crear.mockResolvedValue(habilidadMock);

      const event = { body: JSON.stringify(habilidadMock) };
      const result = await habilidadesHandler.crearHabilidad(event, {});

      expect(result.statusCode).toBe(201);
      expect(habilidadesRepository.crear).toHaveBeenCalledWith(habilidadMock);
    });

    test('debe retornar 409 cuando ya existe una habilidad con el mismo nombre normalizado', async () => {
      const error = new Error('Ya existe una habilidad con ese nombre normalizado');
      error.codigo = 409;
      error.codigoError = 'CONFLICT';
      habilidadesRepository.crear.mockRejectedValue(error);

      const event = {
        body: JSON.stringify({
          habilidadId: 'hab_2',
          nombre: 'javascript',
          categoria: 'Programación',
        }),
      };
      const result = await habilidadesHandler.crearHabilidad(event, {});

      expect(result.statusCode).toBe(409);
    });
  });

  describe('listarHabilidades', () => {
    test('debe listar habilidades con filtros por categoría y nombre', async () => {
      habilidadesRepository.listar.mockResolvedValue({
        items: [{ habilidadId: 'hab_1', nombre: 'JavaScript', categoria: 'Programación' }],
        lastKey: null,
      });

      const event = {
        queryStringParameters: { categoria: 'Programación', nombre: 'Java' },
      };
      const result = await habilidadesHandler.listarHabilidades(event, {});

      expect(result.statusCode).toBe(200);
      expect(habilidadesRepository.listar).toHaveBeenCalledWith({
        categoria: 'Programación',
        nombre: 'Java',
      });
    });
  });

  describe('obtenerHabilidad', () => {
    test('debe retornar una habilidad por su ID', async () => {
      const habilidadMock = { habilidadId: 'hab_1', nombre: 'JavaScript' };
      habilidadesRepository.obtenerPorId.mockResolvedValue(habilidadMock);

      const event = { pathParameters: { habilidadId: 'hab_1' } };
      const result = await habilidadesHandler.obtenerHabilidad(event, {});

      expect(result.statusCode).toBe(200);
      expect(habilidadesRepository.obtenerPorId).toHaveBeenCalledWith('hab_1');
    });

    test('debe retornar 404 cuando la habilidad no existe', async () => {
      habilidadesRepository.obtenerPorId.mockResolvedValue(null);

      const event = { pathParameters: { habilidadId: 'inexistente' } };
      const result = await habilidadesHandler.obtenerHabilidad(event, {});

      expect(result.statusCode).toBe(404);
    });
  });

  describe('actualizarHabilidad', () => {
    test('debe modificar datos de una habilidad', async () => {
      habilidadesRepository.actualizar.mockResolvedValue({ habilidadId: 'hab_1', nombre: 'TypeScript' });

      const event = {
        pathParameters: { habilidadId: 'hab_1' },
        body: JSON.stringify({ nombre: 'TypeScript' }),
      };
      const result = await habilidadesHandler.actualizarHabilidad(event, {});

      expect(result.statusCode).toBe(200);
      expect(habilidadesRepository.actualizar).toHaveBeenCalledWith('hab_1', { nombre: 'TypeScript' });
    });
  });

  describe('cambiarEstadoHabilidad', () => {
    test('debe activar o desactivar una habilidad', async () => {
      habilidadesRepository.cambiarEstado.mockResolvedValue({ habilidadId: 'hab_1', estado: 'INACTIVO' });

      const event = {
        pathParameters: { habilidadId: 'hab_1' },
        body: JSON.stringify({ activo: false }),
      };
      const result = await habilidadesHandler.cambiarEstadoHabilidad(event, {});

      expect(result.statusCode).toBe(200);
      expect(habilidadesRepository.cambiarEstado).toHaveBeenCalledWith('hab_1', false);
    });
  });
});