jest.mock('../src/config/dynamodb', () => require('./helpers/dynamodb.mock').crearMockDynamoDb());
jest.mock('../src/config/environment', () => ({
  tableCargos: 'im_cargos', tableColaboradores: 'im_colaboradores',
}));
const { commandMocks } = require('../src/config/dynamodb');
const repo = require('../src/repositories/cargos.repository');

beforeEach(() => Object.values(commandMocks).forEach((mock) => mock.mockReset()));

test('crear y obtener usan cargoId sin claves sintéticas', async () => {
  commandMocks.PutCommand.mockResolvedValue({});
  const item = await repo.crear({ cargoId: 'c1', nombre: ' Analista ' });
  expect(item.nombre).toBe('Analista');
  expect(item).not.toHaveProperty('pk');
  expect(item).not.toHaveProperty('gsi1pk');
  expect(commandMocks.PutCommand).toHaveBeenCalledWith(expect.objectContaining({
    ConditionExpression: 'attribute_not_exists(cargoId)',
  }));
  commandMocks.GetCommand.mockResolvedValue({ Item: item });
  await expect(repo.obtenerPorId('c1')).resolves.toEqual(item);
  expect(commandMocks.GetCommand).toHaveBeenCalledWith({ TableName: 'im_cargos', Key: { cargoId: 'c1' } });
});

test('listar sin estado usa Scan y conserva paginación', async () => {
  commandMocks.ScanCommand.mockResolvedValue({ Items: [], LastEvaluatedKey: { cargoId: 'c2' } });
  await expect(repo.listar({ limit: 2, lastKey: { cargoId: 'c1' } }))
    .resolves.toEqual({ items: [], lastKey: { cargoId: 'c2' } });
  expect(commandMocks.ScanCommand).toHaveBeenCalledWith({
    TableName: 'im_cargos', Limit: 2, ExclusiveStartKey: { cargoId: 'c1' },
  });
  expect(commandMocks.QueryCommand).not.toHaveBeenCalled();
});

test('listar por estado consulta el GSI1 real', async () => {
  commandMocks.QueryCommand.mockResolvedValue({ Items: [] });
  await repo.listar({ estado: 'ACTIVO' });
  expect(commandMocks.QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
    IndexName: 'GSI1', KeyConditionExpression: '#estado = :estado',
    ExpressionAttributeNames: { '#estado': 'estado' },
    ExpressionAttributeValues: { ':estado': 'ACTIVO' },
  }));
});

test.each([true, false])('cambiarEstado persiste activo=%s', async (activo) => {
  const estado = activo ? 'ACTIVO' : 'INACTIVO';
  commandMocks.GetCommand.mockResolvedValue({ Item: { cargoId: 'c1' } });
  commandMocks.UpdateCommand.mockResolvedValue({ Attributes: { cargoId: 'c1', estado } });
  await expect(repo.cambiarEstado('c1', activo)).resolves.toEqual({ cargoId: 'c1', estado });
  expect(commandMocks.UpdateCommand).toHaveBeenCalledWith(expect.objectContaining({
    Key: { cargoId: 'c1' }, UpdateExpression: expect.stringContaining('#estado = :estado'),
    ExpressionAttributeValues: expect.objectContaining({ ':estado': estado }),
    ConditionExpression: 'attribute_exists(cargoId)',
  }));
});

test('busca vínculos incluso después de una página filtrada vacía', async () => {
  commandMocks.ScanCommand.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { colaboradorId: 'u1' } })
    .mockResolvedValueOnce({ Items: [{ colaboradorId: 'u2' }] });
  await expect(repo.tieneColaboradoresAsociados('c1')).resolves.toBe(true);
  expect(commandMocks.ScanCommand).toHaveBeenNthCalledWith(2, expect.objectContaining({
    ExclusiveStartKey: { colaboradorId: 'u1' }, ExpressionAttributeValues: { ':cargo': 'c1' },
  }));
});

test('sin vínculos retorna false al agotar páginas', async () => {
  commandMocks.ScanCommand.mockResolvedValue({ Items: [] });
  await expect(repo.tieneColaboradoresAsociados('c1')).resolves.toBe(false);
});