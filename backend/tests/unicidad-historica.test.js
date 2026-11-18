jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);
jest.mock('../src/config/environment.js', () => ({
  tableAsignaciones: 'asignaciones-test',
}));

const { commandMocks } = require('../src/config/dynamodb.js');
const dedicacion = require('../src/services/dedicacion.service.js');

beforeEach(() => {
  Object.values(commandMocks).forEach(mock => mock.mockReset());
  commandMocks.GetCommand.mockResolvedValue({});
  commandMocks.ScanCommand.mockResolvedValue({ Items: [] });
});

describe('unicidad contra asignaciones históricas y nuevas', () => {
  test('el UUID estable identifica una pareja de proyecto y colaborador', () => {
    expect(dedicacion.idAsignacionUnica('p1', 'c1'))
      .toBe(dedicacion.idAsignacionUnica('p1', 'c1'));
    expect(dedicacion.idAsignacionUnica('p1', 'c1'))
      .not.toBe(dedicacion.idAsignacionUnica('p1', 'c2'));
  });

  test('bloquea de inmediato si ya existe la asignación de identificador determinista', async () => {
    const asignacionId = dedicacion.idAsignacionUnica('p1', 'c1');
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { asignacionId } });
    await expect(dedicacion.verificarAsignacionUnica('p1', 'c1'))
      .rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.GetCommand).toHaveBeenCalledWith({
      TableName: 'asignaciones-test', Key: { asignacionId }, ConsistentRead: true,
    });
    expect(commandMocks.ScanCommand).not.toHaveBeenCalled();
  });

  test('detecta una asignación histórica en la segunda página de un Scan consistente', async () => {
    commandMocks.ScanCommand
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { asignacionId: 'ultima-pagina' } })
      .mockResolvedValueOnce({ Items: [{
        asignacionId: 'uuid-historico', proyectoId: 'p1',
        colaboradorId: 'c1', estado: 'DESVINCULADA',
      }] });
    await expect(dedicacion.verificarAsignacionUnica('p1', 'c1'))
      .rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.ScanCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'asignaciones-test', ConsistentRead: true,
      FilterExpression: '#p = :proyecto AND #c = :colaborador',
      ExclusiveStartKey: { asignacionId: 'ultima-pagina' },
    }));
    expect(commandMocks.QueryCommand).not.toHaveBeenCalled();
  });

  test('permite continuar cuando no hay ninguna asignación nueva ni histórica', async () => {
    await expect(dedicacion.verificarAsignacionUnica('p1', 'c1'))
      .resolves.toBeUndefined();
    expect(commandMocks.ScanCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'asignaciones-test', ConsistentRead: true,
    }));
  });

  test('si falla la lectura del historial no permite continuar con la asignación', async () => {
    commandMocks.ScanCommand.mockRejectedValueOnce(new Error('Error de lectura DynamoDB'));
    await expect(dedicacion.verificarAsignacionUnica('p1', 'c1'))
      .rejects.toThrow('Error de lectura DynamoDB');
  });
});
