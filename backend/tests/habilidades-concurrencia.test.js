jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);
jest.mock('../src/config/environment.js', () => ({
  tableColaboradores: 'colaboradores-test',
  tableColaboradorHabilidad: 'colaborador-habilidad-test',
  tableHabilidades: 'habilidades-test',
}));

const { commandMocks } = require('../src/config/dynamodb.js');
const relaciones = require('../src/repositories/colaborador-habilidad.repository.js');

beforeEach(() => {
  Object.values(commandMocks).forEach(mock => mock.mockReset());
  commandMocks.GetCommand.mockImplementation(async params => {
    if (params.TableName === 'colaboradores-test') {
      return { Item: { colaboradorId: 'c1', estado: 'ACTIVO', habilidadesRevision: 4 } };
    }
    if (params.TableName === 'habilidades-test') {
      return { Item: { habilidadId: 'h1', estado: 'ACTIVO' } };
    }
    return { Item: { colaboradorId: 'c1', habilidadId: 'h1', nivel: 'JUNIOR' } };
  });
  commandMocks.TransactWriteCommand.mockResolvedValue({});
});

describe('revisiones transaccionales de las habilidades del colaborador', () => {
  test('asociar una habilidad modifica también la revisión del perfil', async () => {
    await relaciones.asociar({ colaboradorId: 'c1', habilidadId: 'h1', nivel: 'MID' });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({
          TableName: 'colaboradores-test',
          ConditionExpression: expect.stringContaining('#rev = :anterior'),
          ExpressionAttributeValues: expect.objectContaining({ ':anterior': 4 }),
        }) },
        { Put: expect.objectContaining({ TableName: 'colaborador-habilidad-test' }) },
      ]),
    });
  });

  test('el cambio de nivel no puede confirmarse sin actualizar la revisión', async () => {
    await relaciones.actualizarNivel('c1', 'h1', { nivel: 'SENIOR' });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({ TableName: 'colaboradores-test' }) },
        { Update: expect.objectContaining({
          TableName: 'colaborador-habilidad-test',
          UpdateExpression: expect.stringContaining('#nivel = :nivel'),
        }) },
      ]),
    });
  });

  test('retirar una habilidad usa la revisión del perfil y un borrado condicional', async () => {
    await relaciones.retirar('c1', 'h1');
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({ TableName: 'colaboradores-test' }) },
        { Delete: expect.objectContaining({
          TableName: 'colaborador-habilidad-test',
          ConditionExpression: expect.stringContaining('attribute_exists'),
        }) },
      ]),
    });
  });

  test('un cambio concurrente de nivel se devuelve como conflicto 409', async () => {
    commandMocks.TransactWriteCommand.mockRejectedValueOnce(Object.assign(
      new Error('Revisión distinta'), { name: 'TransactionCanceledException' },
    ));
    await expect(relaciones.actualizarNivel('c1', 'h1', { nivel: 'SENIOR' }))
      .rejects.toMatchObject({ codigo: 409 });
  });
});
