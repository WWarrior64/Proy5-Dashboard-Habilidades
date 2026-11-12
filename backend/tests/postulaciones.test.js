jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);

jest.mock('../src/services/cache.service.js', () => ({
  obtener: jest.fn(() => undefined), guardar: jest.fn(), eliminar: jest.fn(() => true),
  eliminarPorPrefijo: jest.fn(() => 0), construirClave: (...partes) => partes.filter(Boolean).join(':'),
}));

jest.mock('../src/config/environment.js', () => ({
  tablePostulaciones: 'internal-marketplace-postulaciones-dev', tableProyectos: 'internal-marketplace-proyectos-dev',
  tableColaboradores: 'internal-marketplace-colaboradores-dev', tableAsignaciones: 'internal-marketplace-asignaciones-dev',
}));

const { dynamoDb, commandMocks } = require('../src/config/dynamodb.js');
const cache = require('../src/services/cache.service.js');
const { ErrorApp, CODIGOS } = require('../src/utils/errors.js');
const repo = require('../src/repositories/postulaciones.repository.js');
const handler = require('../src/functions/postulaciones/handler.js');

const COLABORADOR = { colaboradorId: 'c1', estado: 'ACTIVO', disponibilidad: 'DISPONIBLE' };
const PROYECTO = { proyectoId: 'p1', estado: 'ACTIVO' };
const POSTULACION = {
  proyectoId: 'p1', postulacionKey: 'POSTULACION#c1', postulacionId: 'post1', colaboradorId: 'c1',
  estado: 'PENDIENTE', fechaPostulacion: '2026-01-01T00:00:00.000Z', fechaActualizacion: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  dynamoDb.send.mockClear();
  commandMocks.GetCommand.mockReset(); commandMocks.PutCommand.mockReset(); commandMocks.UpdateCommand.mockReset();
  commandMocks.DeleteCommand.mockReset(); commandMocks.QueryCommand.mockReset(); commandMocks.ScanCommand.mockReset();
  commandMocks.TransactWriteCommand.mockReset();
  cache.obtener.mockReset(); cache.guardar.mockReset(); cache.eliminar.mockReset(); cache.eliminarPorPrefijo.mockReset();
  cache.obtener.mockReturnValue(undefined);
  commandMocks.GetCommand.mockImplementation(async (params) => {
    if (params.TableName === 'internal-marketplace-proyectos-dev') return { Item: PROYECTO };
    if (params.TableName === 'internal-marketplace-colaboradores-dev') return { Item: COLABORADOR };
    return {};
  });
  commandMocks.PutCommand.mockResolvedValue({});
  commandMocks.UpdateCommand.mockResolvedValue({ Attributes: {} });
  commandMocks.QueryCommand.mockResolvedValue({ Items: [] });
  commandMocks.TransactWriteCommand.mockResolvedValue({});
});

describe('Repositorio: postulaciones', () => {
  test('handler rechaza JSON inválido sin registrar una postulación', async () => {
    const respuesta = await handler.crearPostulacion({ body: '{invalido' }, {});
    expect(respuesta.statusCode).toBe(400);
    expect(commandMocks.PutCommand).not.toHaveBeenCalled();
  });

  test('consulta envía QueryCommand real y devuelve [] si no hay Items', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({});
    await expect(repo.consultarPostulacionesProyecto('p1')).resolves.toEqual([]);
    const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
    expect(dynamoDb.send).toHaveBeenCalledTimes(1);
    const [command] = dynamoDb.send.mock.calls[0];
    expect(command).toBeInstanceOf(QueryCommand);
    expect(command.input).toEqual({
      TableName: 'internal-marketplace-postulaciones-dev',
      KeyConditionExpression: '#p = :p',
      ExpressionAttributeNames: { '#p': 'proyectoId' },
      ExpressionAttributeValues: { ':p': 'p1' },
    });
  });

  test('propaga errores de consulta sin convertirlos en listas vacías', async () => {
    const error = new Error('DynamoDB no disponible');
    commandMocks.QueryCommand.mockRejectedValueOnce(error);
    await expect(repo.consultarPostulacionesProyecto('p1')).rejects.toBe(error);
  });

  test('convierte una postulación duplicada en conflicto', async () => {
    commandMocks.PutCommand.mockRejectedValueOnce(Object.assign(new Error('Duplicado'), {
      name: 'ConditionalCheckFailedException',
    }));
    await expect(repo.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'c1' }))
      .rejects.toMatchObject({ codigo: 409, codigoError: CODIGOS.CONFLICTO });
  });
  test('crearPostulacion registra la postulaci�n de un colaborador a un proyecto activo', async () => {
    const item = await repo.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'c1', comentario: 'Interesado' });
    expect(commandMocks.GetCommand).toHaveBeenNthCalledWith(1, { TableName: 'internal-marketplace-colaboradores-dev', Key: { colaboradorId: 'c1' } });
    expect(commandMocks.GetCommand).toHaveBeenNthCalledWith(2, { TableName: 'internal-marketplace-proyectos-dev', Key: { proyectoId: 'p1' } });
    expect(commandMocks.PutCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'internal-marketplace-postulaciones-dev',
      Item: expect.objectContaining({ estado: 'PENDIENTE', proyectoId: 'p1', colaboradorId: 'c1', postulacionKey: 'POSTULACION#c1' }),
      ConditionExpression: 'attribute_not_exists(postulacionKey)',
    }));
    expect(item.estado).toBe('PENDIENTE');
    expect(item.postulacionId).toBeDefined();
  });

  test('crearPostulacion rechaza colaborador inexistente o inactivo', async () => {
    commandMocks.GetCommand.mockImplementation(async (params) => (params.TableName === 'internal-marketplace-proyectos-dev' ? { Item: PROYECTO } : {}));
    await expect(repo.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'c1' })).rejects.toMatchObject({ codigo: 404 });
    commandMocks.GetCommand.mockImplementation(async (params) => (params.TableName === 'internal-marketplace-proyectos-dev' ? { Item: PROYECTO } : { Item: { colaboradorId: 'c1', estado: 'INACTIVO' } }));
    await expect(repo.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'c1' })).rejects.toMatchObject({ codigo: 400 });
    expect(commandMocks.PutCommand).not.toHaveBeenCalled();
  });

  test('crearPostulacion rechaza proyecto inexistente o no activo', async () => {
    commandMocks.GetCommand.mockImplementation(async (params) => (params.TableName === 'internal-marketplace-colaboradores-dev' ? { Item: COLABORADOR } : { Item: { proyectoId: 'p1', estado: 'CANCELADO' } }));
    await expect(repo.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'c1' })).rejects.toMatchObject({ codigo: 400 });
  });

  test('consultarPostulacionesProyecto consulta por proyectoId', async () => {
    const items = [POSTULACION];
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: items });
    const resultado = await repo.consultarPostulacionesProyecto('p1');
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'internal-marketplace-postulaciones-dev', KeyConditionExpression: '#p = :p', ExpressionAttributeValues: { ':p': 'p1' },
    }));
    expect(resultado).toEqual(items);
  });

  test('consultarPostulacionesColaborador consulta por colaborador en GSI1', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [POSTULACION] });
    const resultado = await repo.consultarPostulacionesColaborador('c1');
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'internal-marketplace-postulaciones-dev', IndexName: 'GSI1', ExpressionAttributeValues: { ':c': 'c1' },
    }));
    expect(resultado).toEqual([POSTULACION]);
  });

  test('obtenerPostulacion devuelve la postulaci�n por clave compuesta o 404', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: POSTULACION });
    const resultado = await repo.obtenerPostulacion('p1', 'c1');
    expect(commandMocks.GetCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'internal-marketplace-postulaciones-dev', Key: { proyectoId: 'p1', postulacionKey: 'POSTULACION#c1' },
    }));
    expect(resultado).toEqual(POSTULACION);
    commandMocks.GetCommand.mockResolvedValueOnce({});
    await expect(repo.obtenerPostulacion('p1', 'c2')).rejects.toMatchObject({ codigo: 404 });
  });

  test('aceptarPostulacion usa TransactWriteItems y crea asignaci�n', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: POSTULACION });
    commandMocks.TransactWriteCommand.mockResolvedValue({});
    const resultado = await repo.aceptarPostulacion('p1', 'c1', { revisadoPor: 'admin', observacionRevision: 'OK', porcentajeDedicacion: 50, horasAsignadas: 100 });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith(expect.objectContaining({
      TransactItems: expect.arrayContaining([
        expect.objectContaining({ Update: expect.any(Object) }),
        expect.objectContaining({ Put: expect.any(Object) }),
      ]),
    }));
    expect(resultado.postulacion.estado).toBe('ACEPTADA');
    expect(resultado.postulacion.revisadoPor).toBe('admin');
    expect(resultado.asignacion).toBeDefined();
  });

  test('aceptarPostulacion rechaza si ya fue procesada (no PENDIENTE)', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { ...POSTULACION, estado: 'ACEPTADA' } });
    await expect(repo.aceptarPostulacion('p1', 'c1', { revisadoPor: 'admin' })).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('rechazarPostulacion cambia a RECHAZADA con revisor y fecha', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: POSTULACION });
    commandMocks.UpdateCommand.mockResolvedValue({ Attributes: { ...POSTULACION, estado: 'RECHAZADA', revisadoPor: 'admin' } });
    const resultado = await repo.rechazarPostulacion('p1', 'c1', { revisadoPor: 'admin', observacionRevision: 'No cumple' });
    
    expect(commandMocks.UpdateCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'internal-marketplace-postulaciones-dev',
        Key: { proyectoId: 'p1', postulacionKey: 'POSTULACION#c1' }
      })
    );
    expect(resultado.estado).toBe('RECHAZADA');
  });

  test('retirarPostulacion cambia a RETIRADA', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: POSTULACION });
    commandMocks.UpdateCommand.mockResolvedValue({ Attributes: { ...POSTULACION, estado: 'RETIRADA', revisadoPor: 'c1' } });
    const resultado = await repo.retirarPostulacion('p1', 'c1', { revisadoPor: 'c1' });
    expect(resultado.estado).toBe('RETIRADA');
  });
});


describe('Handler: postulaciones', () => {
  test('crearPostulacion devuelve 201 con la postulaci�n', async () => {
    commandMocks.GetCommand.mockImplementationOnce(async () => ({ Item: COLABORADOR }));
    commandMocks.GetCommand.mockImplementationOnce(async () => ({ Item: PROYECTO }));
    commandMocks.PutCommand.mockResolvedValue({});
    const resultado = await handler.crearPostulacion({
      body: JSON.stringify({ proyectoId: 'p1', colaboradorId: 'c1', comentario: 'Hola' }),
      pathParameters: {}, queryStringParameters: null,
    }, {});
    expect(resultado.statusCode).toBe(201);
    expect(JSON.parse(resultado.body).success).toBe(true);
  });

  test('obtenerPostulacion devuelve 404 si no existe', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({});
    const resultado = await handler.obtenerPostulacion({
      pathParameters: { proyectoId: 'p1', colaboradorId: 'c9' },
      queryStringParameters: null,
    }, {});
    expect(resultado.statusCode).toBe(404);
    expect(JSON.parse(resultado.body).success).toBe(false);
  });

  test('rechazarPostulacion mapea el resultado del repositorio', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: POSTULACION });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { ...POSTULACION, estado: 'RECHAZADA', revisadoPor: 'admin' } });
    const resultado = await handler.rechazarPostulacion({
      pathParameters: { proyectoId: 'p1', colaboradorId: 'c1' },
      body: JSON.stringify({ revisadoPor: 'admin', observacionRevision: 'x' }),
      queryStringParameters: null,
    }, {});
    expect(resultado.statusCode).toBe(200);
    expect(JSON.parse(resultado.body).datos.estado).toBe('RECHAZADA');
  });
});


