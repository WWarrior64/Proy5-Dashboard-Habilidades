const cargosHandler = require('../src/functions/cargos/handler');
const cargosRepository = require('../src/repositories/cargos.repository');

jest.mock('../src/repositories/cargos.repository');

describe('Módulo de Cargos - Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('crearCargo', () => {
    test('debe crear un cargo válido', async () => {
      const cargoMock = {
        cargoId: 'cargo_1',
        nombre: 'Desarrollador Senior',
        descripcion: 'Encargado de desarrollo',
        categoria: 'Tecnología',
        estado: 'ACTIVO',
      };
      cargosRepository.crear.mockResolvedValue(cargoMock);

      const event = { body: JSON.stringify(cargoMock) };
      const result = await cargosHandler.crearCargo(event, {});

      expect(result.statusCode).toBe(201);
      expect(cargosRepository.crear).toHaveBeenCalledWith(cargoMock);
    });

    test('debe retornar 400 cuando faltan campos requeridos', async () => {
      const event = { body: JSON.stringify({ nombre: 'Solo nombre' }) };
      const result = await cargosHandler.crearCargo(event, {});

      expect(result.statusCode).toBe(400);
    });
  });

  describe('listarCargos', () => {
    test('debe listar cargos con filtro de estado', async () => {
      cargosRepository.listar.mockResolvedValue({
        items: [{ cargoId: 'cargo_1', estado: 'ACTIVO' }],
        lastKey: null,
      });

      const event = { queryStringParameters: { estado: 'ACTIVO' } };
      const result = await cargosHandler.listarCargos(event, {});

      expect(result.statusCode).toBe(200);
      expect(cargosRepository.listar).toHaveBeenCalledWith({ estado: 'ACTIVO' });
    });
  });

  describe('obtenerCargo', () => {
    test('debe retornar un cargo por su ID', async () => {
      const cargoMock = { cargoId: 'cargo_1', nombre: 'Desarrollador' };
      cargosRepository.obtenerPorId.mockResolvedValue(cargoMock);

      const event = { pathParameters: { cargoId: 'cargo_1' } };
      const result = await cargosHandler.obtenerCargo(event, {});

      expect(result.statusCode).toBe(200);
      expect(cargosRepository.obtenerPorId).toHaveBeenCalledWith('cargo_1');
    });

    test('debe retornar 404 cuando el cargo no existe', async () => {
      cargosRepository.obtenerPorId.mockResolvedValue(null);

      const event = { pathParameters: { cargoId: 'inexistente' } };
      const result = await cargosHandler.obtenerCargo(event, {});

      expect(result.statusCode).toBe(404);
    });
  });

  describe('actualizarCargo', () => {
    test('debe modificar nombre, descripción y categoría de un cargo', async () => {
      cargosRepository.actualizar.mockResolvedValue({ cargoId: 'cargo_1', nombre: 'Nuevo Nombre' });

      const event = {
        pathParameters: { cargoId: 'cargo_1' },
        body: JSON.stringify({ nombre: 'Nuevo Nombre' }),
      };
      const result = await cargosHandler.actualizarCargo(event, {});

      expect(result.statusCode).toBe(200);
      expect(cargosRepository.actualizar).toHaveBeenCalledWith('cargo_1', { nombre: 'Nuevo Nombre' });
    });
  });

  describe('cambiarEstadoCargo', () => {
    test('debe desactivar un cargo sin colaboradores asociados', async () => {
      cargosRepository.tieneColaboradoresAsociados.mockResolvedValue(false);
      cargosRepository.cambiarEstado.mockResolvedValue({ cargoId: 'cargo_1', estado: 'INACTIVO' });

      const event = {
        pathParameters: { cargoId: 'cargo_1' },
        body: JSON.stringify({ activo: false }),
      };
      const result = await cargosHandler.cambiarEstadoCargo(event, {});

      expect(result.statusCode).toBe(200);
      expect(cargosRepository.cambiarEstado).toHaveBeenCalledWith('cargo_1', false);
    });

    test('debe retornar 400 al intentar desactivar un cargo con colaboradores asociados', async () => {
      cargosRepository.tieneColaboradoresAsociados.mockResolvedValue(true);

      const event = {
        pathParameters: { cargoId: 'cargo_1' },
        body: JSON.stringify({ activo: false }),
      };
      const result = await cargosHandler.cambiarEstadoCargo(event, {});

      expect(result.statusCode).toBe(400);
    });
  });
});