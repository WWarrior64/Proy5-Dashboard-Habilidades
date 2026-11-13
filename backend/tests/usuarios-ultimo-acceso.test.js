jest.mock('../src/config/dynamodb', () => require('./helpers/dynamodb.mock').crearMockDynamoDb());
const repositorio = require('../src/repositories/usuarios.repository');
const { commandMocks } = require('../src/config/dynamodb');

beforeEach(() => {
  Object.values(commandMocks).forEach(mock => mock.mockReset());
});

describe('Último acceso persistido en DynamoDB', () => {
  test('utiliza la hora del servidor y actualiza solo un usuario activo existente', async () => {
    const usuario = { usuarioId: 'usr_1', estado: 'ACTIVO', ultimoAcceso: '2026-11-13T18:40:00.000Z' };
    commandMocks.UpdateCommand.mockResolvedValue({ Attributes: usuario });
    expect(await repositorio.registrarUltimoAcceso('usr_1')).toEqual(usuario);
    expect(commandMocks.UpdateCommand).toHaveBeenCalledWith(expect.objectContaining({
      Key: { usuarioId: 'usr_1' },
      UpdateExpression: 'SET #ultimoAcceso = :fecha',
      ConditionExpression: 'attribute_exists(usuarioId) AND #estado = :activo',
      ExpressionAttributeValues: expect.objectContaining({ ':activo': 'ACTIVO', ':fecha': expect.any(String) }),
      ReturnValues: 'ALL_NEW',
    }));
    expect(Number.isNaN(Date.parse(commandMocks.UpdateCommand.mock.calls[0][0].ExpressionAttributeValues[':fecha']))).toBe(false);
  });

  test('rechaza usuarios eliminados o desactivados', async () => {
    commandMocks.UpdateCommand.mockRejectedValueOnce(Object.assign(new Error('Condición incumplida'), {
      name: 'ConditionalCheckFailedException',
    }));
    await expect(repositorio.registrarUltimoAcceso('usr_inactivo')).rejects.toMatchObject({ codigo: 403 });
  });
});
