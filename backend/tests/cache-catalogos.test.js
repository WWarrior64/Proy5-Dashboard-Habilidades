jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);
jest.mock('../src/config/environment.js', () => ({
  tableHabilidades: 'habilidades-test',
  tableCargos: 'cargos-test',
  tableColaboradores: 'colaboradores-test',
}));

const { commandMocks } = require('../src/config/dynamodb.js');
const cache = require('../src/services/cache.service.js');
const habilidades = require('../src/repositories/habilidades.repository.js');
const cargos = require('../src/repositories/cargos.repository.js');

beforeEach(() => {
  cache.limpiar();
  Object.values(commandMocks).forEach(mock => mock.mockReset());
});
afterEach(() => cache.limpiar());

describe('claves de caché de catálogos y consistencia de lecturas', () => {
  test('categoría y nombre de habilidades no comparten clave aunque tengan el mismo valor', async () => {
    commandMocks.ScanCommand
      .mockResolvedValueOnce({ Items: [{ habilidadId: 'h1', categoria: 'GENERAL' }] })
      .mockResolvedValueOnce({ Items: [{ habilidadId: 'h2', nombre: 'GENERAL' }] });

    const porCategoria = await habilidades.listar({ categoria: 'GENERAL', limit: 25 });
    const porNombre = await habilidades.listar({ nombre: 'GENERAL', limit: 25 });

    expect(porCategoria.items[0].habilidadId).toBe('h1');
    expect(porNombre.items[0].habilidadId).toBe('h2');
    expect(commandMocks.ScanCommand).toHaveBeenCalledTimes(2);
    await habilidades.listar({ categoria: 'GENERAL', limit: 25 });
    expect(commandMocks.ScanCommand).toHaveBeenCalledTimes(2);
  });

  test('cada página de habilidades usa una clave independiente', async () => {
    commandMocks.ScanCommand
      .mockResolvedValueOnce({ Items: [{ habilidadId: 'h1' }], LastEvaluatedKey: { habilidadId: 'h1' } })
      .mockResolvedValueOnce({ Items: [{ habilidadId: 'h2' }] });

    const primera = await habilidades.listar({ estado: 'ACTIVO', limit: 1 });
    const segunda = await habilidades.listar({ estado: 'ACTIVO', limit: 1, lastKey: primera.lastKey });

    expect(primera.items[0].habilidadId).toBe('h1');
    expect(segunda.items[0].habilidadId).toBe('h2');
    expect(commandMocks.ScanCommand).toHaveBeenCalledTimes(2);
    expect(commandMocks.ScanCommand).toHaveBeenNthCalledWith(2, expect.objectContaining({
      ExclusiveStartKey: { habilidadId: 'h1' },
    }));
  });

  test('una escritura confirmada invalida el catálogo de habilidades', async () => {
    commandMocks.ScanCommand
      .mockResolvedValueOnce({ Items: [{ habilidadId: 'h1' }] })
      .mockResolvedValueOnce({ Items: [{ habilidadId: 'h1' }, { habilidadId: 'h2' }] });
    commandMocks.TransactWriteCommand.mockResolvedValue({});

    await habilidades.listar({ estado: 'ACTIVO' });
    await habilidades.crear({ habilidadId: 'h2', nombre: 'Docker' });
    const actualizado = await habilidades.listar({ estado: 'ACTIVO' });

    expect(actualizado.items).toHaveLength(2);
    expect(commandMocks.ScanCommand).toHaveBeenCalledTimes(2);
  });

  test('una consulta fallida no almacena resultados y se reintenta en DynamoDB', async () => {
    commandMocks.ScanCommand
      .mockRejectedValueOnce(new Error('DynamoDB temporalmente no disponible'))
      .mockResolvedValueOnce({ Items: [{ habilidadId: 'h1' }] });

    await expect(habilidades.listar({ categoria: 'GENERAL' })).rejects.toThrow('DynamoDB');
    await expect(habilidades.listar({ categoria: 'GENERAL' }))
      .resolves.toMatchObject({ items: [{ habilidadId: 'h1' }] });
    expect(commandMocks.ScanCommand).toHaveBeenCalledTimes(2);
  });

  test('cargos conserva el cursor de paginación y reutiliza la página consultada', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({
      Items: [{ cargoId: 'c1' }], LastEvaluatedKey: { cargoId: 'c1' },
    }).mockResolvedValueOnce({ Items: [{ cargoId: 'c2' }] });

    const primero = await cargos.listar({ estado: 'ACTIVO', limit: 1 });
    const segundo = await cargos.listar({ estado: 'ACTIVO', limit: 1, lastKey: primero.lastKey });
    expect(segundo.items[0].cargoId).toBe('c2');
    await cargos.listar({ estado: 'ACTIVO', limit: 1 });
    expect(commandMocks.QueryCommand).toHaveBeenCalledTimes(2);
  });
});
