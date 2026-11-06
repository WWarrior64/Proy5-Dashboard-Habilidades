jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);

jest.mock('../src/services/cache.service.js', () => ({
  obtener: jest.fn(() => undefined),
  guardar: jest.fn(),
  eliminar: jest.fn(() => true),
  eliminarPorPrefijo: jest.fn(() => 0),
  construirClave: (...partes) => partes.filter(Boolean).join(':'),
}));

jest.mock('../src/config/environment.js', () => ({
  tableAsignaciones: 'im_asignaciones', tableColaboradores: 'im_colaboradores', tableProyectos: 'im_proyectos',
}));

const { dynamoDb, commandMocks } = require('../src/config/dynamodb.js');
const cache = require('../src/services/cache.service.js');
const { ErrorApp, CODIGOS } = require('../src/utils/errors.js');
const repo = require('../src/repositories/asignaciones.repository.js');
const handler = require('../src/functions/asignaciones/handler.js');


const COLABORADOR = { colaboradorId: 'c1', estado: 'ACTIVO', disponibilidad: 'DISPONIBLE' };
const PROYECTO = { proyectoId: 'p1', estado: 'ACTIVO' };

beforeEach(() => {
  dynamoDb.send.mockClear();
  cache.obtener.mockReset();
  cache.guardar.mockReset();
  cache.eliminar.mockReset();
  cache.eliminarPorPrefijo.mockReset();
  cache.obtener.mockReturnValue(undefined);
  Object.values(commandMocks).forEach((mock) => mock.mockReset());
  commandMocks.GetCommand.mockImplementation(async (input) => {
    if (input.TableName === 'im_proyectos') return { Item: PROYECTO };
    if (input.TableName === 'im_colaboradores') return { Item: COLABORADOR };
    return {};
  });
  commandMocks.QueryCommand.mockResolvedValue({ Items: [] });
  commandMocks.PutCommand.mockResolvedValue({});
});

describe('Repositorio: asignaciones', () => {
  test('rechaza dedicación acumulada superior al 100 % sin escribir', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({
      Items: [{ asignacionId: 'previa', porcentajeDedicacion: 70 }],
    });
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 40,
      horasAsignadas: 100, creadoPor: 'admin',
    })).rejects.toMatchObject({ codigo: 400, codigoError: CODIGOS.VALIDACION });
    expect(commandMocks.PutCommand).not.toHaveBeenCalled();
  });
  test('crearAsignacion vincula colaborador activo a proyecto activo respetando el límite del 100 %', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: COLABORADOR });
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: PROYECTO });
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [] });
    commandMocks.PutCommand.mockResolvedValue({});

    const asignacion = await repo.crearAsignacion({
      colaboradorId: 'c1',
      proyectoId: 'p1',
      porcentajeDedicacion: 40,
      horasAsignadas: 100,
      creadoPor: 'admin',
    });

    expect(commandMocks.GetCommand).toHaveBeenNthCalledWith(1, {
      TableName: 'im_colaboradores',
      Key: { colaboradorId: 'c1' },
    });
    expect(commandMocks.GetCommand).toHaveBeenNthCalledWith(2, {
      TableName: 'im_proyectos',
      Key: { proyectoId: 'p1' },
    });
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_asignaciones',
        IndexName: 'GSI1',
        KeyConditionExpression: expect.stringContaining('begins_with'),
      })
    );
    expect(commandMocks.PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_asignaciones',
        Item: expect.objectContaining({
          porcentajeDedicacion: 40,
          horasAsignadas: 100,
          horasCompletadas: 0,
          estado: 'ACTIVA',
        }),
        ConditionExpression: 'attribute_not_exists(asignacionId)',
      })
    );
    expect(asignacion.asignacionId).toBeDefined();
    expect(cache.eliminar).toHaveBeenCalledWith(expect.stringMatching(/^asignacion:/));
    expect(cache.eliminarPorPrefijo).toHaveBeenCalledWith('asignaciones:');
  });

  test('crearAsignacion rechaza porcentaje de dedicacion fuera de 1..100', async () => {
    await expect(repo.crearAsignacion({ colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 0, horasAsignadas: 10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 400, codigoError: CODIGOS.VALIDACION });
    await expect(repo.crearAsignacion({ colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 101, horasAsignadas: 10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 400 });
    expect(commandMocks.PutCommand).not.toHaveBeenCalled();
  });

  test('crearAsignacion rechaza horas asignadas no positivas', async () => {
    await expect(repo.crearAsignacion({ colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 40, horasAsignadas: -10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 400 });
    expect(commandMocks.PutCommand).not.toHaveBeenCalled();
  });

  test('crearAsignacion rechaza colaborador inexistente o inactivo', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({});
    await expect(repo.crearAsignacion({ colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 40, horasAsignadas: 10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 404 });

    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { colaboradorId: 'c1', estado: 'INACTIVO' } });
    await expect(repo.crearAsignacion({ colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 40, horasAsignadas: 10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 400 });
  });

  test('crearAsignacion rechaza proyecto inexistente o no activo', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: COLABORADOR });
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { proyectoId: 'p1', estado: 'CANCELADO' } });
    await expect(repo.crearAsignacion({ colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 40, horasAsignadas: 10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 400 });
  });

  test('listarAsignacionesActivas consulta el GSI3 y cachea', async () => {
    const items = [{ asignacionId: 'a1', estado: 'ACTIVA' }];
    commandMocks.QueryCommand.mockResolvedValue({ Items: items });
    const resultado = await repo.listarAsignacionesActivas();
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_asignaciones',
        IndexName: 'GSI3',
        KeyConditionExpression: '#est = :est',
        ExpressionAttributeValues: { ':est': 'ACTIVA' },
      })
    );
    expect(resultado).toEqual(items);
    expect(cache.guardar).toHaveBeenCalledWith('asignaciones:activas', items, 60000);
  });

  test('listarAsignacionesColaborador consulta el GSI1 con filtro ACTIVA', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [] });
    await repo.listarAsignacionesColaborador('c1');
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        IndexName: 'GSI1',
        ExpressionAttributeValues: { ':c': 'c1', ':prefijo': 'ACTIVA#' },
      })
    );
  });

  test('listarAsignacionesProyecto consulta el GSI2 con filtro ACTIVA', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [] });
    await repo.listarAsignacionesProyecto('p1');
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        IndexName: 'GSI2',
        ExpressionAttributeValues: { ':p': 'p1', ':prefijo': 'ACTIVA#' },
      })
    );
  });

  test('obtenerAsignacion devuelve la asignación o 404', async () => {
    const item = { asignacionId: 'a1', estado: 'ACTIVA', colaboradorId: 'c1', proyectoId: 'p1' };
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: item });
    const resultado = await repo.obtenerAsignacion('a1');
    expect(resultado).toEqual(item);
    expect(cache.guardar).toHaveBeenCalledWith('asignacion:a1', item, 60000);

    commandMocks.GetCommand.mockResolvedValueOnce({});
    await expect(repo.obtenerAsignacion('a-no')).rejects.toMatchObject({ codigo: 404 });
  });

  test('actualizarAsignacion valida dedicación acumulada y horas', async () => {
    const existente = { asignacionId: 'a1', colaboradorId: 'c1', proyectoId: 'p1', horasAsignadas: 50, horasCompletadas: 10, porcentajeDedicacion: 30, estado: 'ACTIVA' };
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: existente });
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [] });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { ...existente, horasAsignadas: 80 } });

    const resultado = await repo.actualizarAsignacion('a1', { horasAsignadas: 80, porcentajeDedicacion: 50 });
    expect(resultado.horasAsignadas).toBe(80);
    expect(cache.eliminar).toHaveBeenCalledWith(expect.stringMatching(/^asignacion:/));
  });

  test('actualizarAsignacion rechaza horas completadas mayores a las asignadas', async () => {
    const existente = { asignacionId: 'a1', colaboradorId: 'c1', proyectoId: 'p1', horasAsignadas: 50, horasCompletadas: 10, porcentajeDedicacion: 30, estado: 'ACTIVA' };
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: existente });
    await expect(repo.actualizarAsignacion('a1', { horasCompletadas: 60 })).rejects.toMatchObject({ codigo: 400 });
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
  });

  test('actualizarAsignacion lanza 404 si la asignación no está activa o no existe', async () => {
    commandMocks.GetCommand.mockImplementation(async () => ({ Item: { asignacionId: 'a1', colaboradorId: 'c1', proyectoId: 'p1', horasAsignadas: 50, horasCompletadas: 0, estado: 'DESVINCULADA' } }));
    commandMocks.UpdateCommand.mockResolvedValue({});
    await expect(repo.actualizarAsignacion('a1', { porcentajeDedicacion: 20 })).rejects.toMatchObject({ codigo: 404 });
  });

  test('desvincularAsignacion cambia a DESVINCULADA con fechaFin y no elimina físicamente', async () => {
    const existente = { asignacionId: 'a1', colaboradorId: 'c1', proyectoId: 'p1', estado: 'ACTIVA' };
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: existente });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { ...existente, estado: 'DESVINCULADA', fechaFin: expect.anything() } });

    const resultado = await repo.desvincularAsignacion('a1');
    expect(commandMocks.UpdateCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_asignaciones',
        Key: { asignacionId: 'a1' },
        ExpressionAttributeValues: expect.objectContaining({ ':estado': 'DESVINCULADA' }),
      })
    );
    expect(resultado.estado).toBe('DESVINCULADA');
    expect(commandMocks.DeleteCommand).not.toHaveBeenCalled();

    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { ...existente, estado: 'DESVINCULADA' } });
    await expect(repo.desvincularAsignacion('a1')).rejects.toMatchObject({ codigo: 409 });
  });
});

describe('Handler: asignaciones', () => {
  test('crearAsignacion devuelve 201 con la asignación', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: COLABORADOR });
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: PROYECTO });
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [] });
    commandMocks.PutCommand.mockResolvedValue({});
    const resultado = await handler.crearAsignacion({
      body: JSON.stringify({ colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 40, horasAsignadas: 100, creadoPor: 'admin' }),
      pathParameters: {},
      queryStringParameters: null,
    }, {});
    expect(resultado.statusCode).toBe(201);
    expect(JSON.parse(resultado.body).success).toBe(true);
  });

  test('listarAsignacionesActivas devuelve las asignaciones activas', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [{ asignacionId: 'a1', estado: 'ACTIVA' }] });
    const resultado = await handler.listarAsignacionesActivas({}, {});
    expect(resultado.statusCode).toBe(200);
    expect(JSON.parse(resultado.body).datos.length).toBe(1);
  });

  test('desvincularAsignacion mapea el resultado del repositorio', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { asignacionId: 'a1', colaboradorId: 'c1', proyectoId: 'p1', estado: 'ACTIVA' } });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { asignacionId: 'a1', estado: 'DESVINCULADA' } });
    const resultado = await handler.desvincularAsignacion({ pathParameters: { asignacionId: 'a1' } }, {});
    expect(resultado.statusCode).toBe(200);
    expect(JSON.parse(resultado.body).datos.estado).toBe('DESVINCULADA');
  });

});








