jest.mock('../src/config/dynamodb.js', () => {
  const m = {
    get: jest.fn(), put: jest.fn(), update: jest.fn(), delete: jest.fn(),
    query: jest.fn(), scan: jest.fn(), transactWrite: jest.fn(),
  };
  return { dynamoDb: m, client: {} };
});

jest.mock('../src/services/cache.service.js', () => ({
  obtener: jest.fn(() => undefined), guardar: jest.fn(), eliminar: jest.fn(() => true),
  eliminarPorPrefijo: jest.fn(() => 0), construirClave: (...partes) => partes.filter(Boolean).join(':'),
}));

jest.mock('../src/config/environment.js', () => ({
  tablePostulaciones: 'im_postulaciones', tableProyectos: 'im_proyectos',
  tableColaboradores: 'im_colaboradores', tableAsignaciones: 'im_asignaciones',
}));

const { dynamoDb } = require('../src/config/dynamodb.js');
const cache = require('../src/services/cache.service.js');
const { ErrorApp, CODIGOS } = require('../src/utils/errors.js');
const repo = require('../src/repositories/postulaciones.repository.js');
const handler = require('../src/functions/postulaciones/handler.js');

const COLABORADOR = { colaboradorId: 'c1', estado: 'ACTIVO', disponibilidad: 'DISPONIBLE' };
const PROYECTO = { proyectoId: 'p1', estado: 'ACTIVO' };
const POSTULACION = {
  proyectoId: 'p1', sk: 'POSTULACION#c1', postulacionId: 'post1', colaboradorId: 'c1',
  estado: 'PENDIENTE', fechaPostulacion: '2026-01-01T00:00:00.000Z', fechaActualizacion: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  dynamoDb.get.mockReset(); dynamoDb.put.mockReset(); dynamoDb.update.mockReset();
  dynamoDb.delete.mockReset(); dynamoDb.query.mockReset(); dynamoDb.scan.mockReset();
  dynamoDb.transactWrite.mockReset();
  cache.obtener.mockReset(); cache.guardar.mockReset(); cache.eliminar.mockReset(); cache.eliminarPorPrefijo.mockReset();
  cache.obtener.mockReturnValue(undefined);
  dynamoDb.get.mockImplementation(async (params) => {
    if (params.TableName === 'im_proyectos') return { Item: PROYECTO };
    if (params.TableName === 'im_colaboradores') return { Item: COLABORADOR };
    return {};
  });
  dynamoDb.put.mockResolvedValue({});
  dynamoDb.update.mockResolvedValue({ Attributes: {} });
  dynamoDb.query.mockResolvedValue({ Items: [] });
  dynamoDb.transactWrite.mockResolvedValue({});
});

describe('Repositorio: postulaciones', () => {
  test('crearPostulacion registra la postulaci�n de un colaborador a un proyecto activo', async () => {
    const item = await repo.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'c1', comentario: 'Interesado' });
    expect(dynamoDb.get).toHaveBeenNthCalledWith(1, { TableName: 'im_colaboradores', Key: { colaboradorId: 'c1' } });
    expect(dynamoDb.get).toHaveBeenNthCalledWith(2, { TableName: 'im_proyectos', Key: { proyectoId: 'p1' } });
    expect(dynamoDb.put).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'im_postulaciones',
      Item: expect.objectContaining({ estado: 'PENDIENTE', proyectoId: 'p1', colaboradorId: 'c1', sk: 'POSTULACION#c1' }),
      ConditionExpression: 'attribute_not_exists(sk)',
    }));
    expect(item.estado).toBe('PENDIENTE');
    expect(item.postulacionId).toBeDefined();
  });

  test('crearPostulacion rechaza colaborador inexistente o inactivo', async () => {
    dynamoDb.get.mockImplementation(async (params) => (params.TableName === 'im_proyectos' ? { Item: PROYECTO } : {}));
    await expect(repo.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'c1' })).rejects.toMatchObject({ codigo: 404 });
    dynamoDb.get.mockImplementation(async (params) => (params.TableName === 'im_proyectos' ? { Item: PROYECTO } : { Item: { colaboradorId: 'c1', estado: 'INACTIVO' } }));
    await expect(repo.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'c1' })).rejects.toMatchObject({ codigo: 400 });
    expect(dynamoDb.put).not.toHaveBeenCalled();
  });

  test('crearPostulacion rechaza proyecto inexistente o no activo', async () => {
    dynamoDb.get.mockImplementation(async (params) => (params.TableName === 'im_colaboradores' ? { Item: COLABORADOR } : { Item: { proyectoId: 'p1', estado: 'CANCELADO' } }));
    await expect(repo.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'c1' })).rejects.toMatchObject({ codigo: 400 });
  });

  test('consultarPostulacionesProyecto consulta por proyectoId', async () => {
    const items = [POSTULACION];
    dynamoDb.query.mockResolvedValueOnce({ Items: items });
    const resultado = await repo.consultarPostulacionesProyecto('p1');
    expect(dynamoDb.query).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'im_postulaciones', KeyConditionExpression: '#p = :p', ExpressionAttributeValues: { ':p': 'p1' },
    }));
    expect(resultado).toEqual(items);
  });

  test('consultarPostulacionesColaborador consulta por colaborador en GSI1', async () => {
    dynamoDb.query.mockResolvedValueOnce({ Items: [POSTULACION] });
    const resultado = await repo.consultarPostulacionesColaborador('c1');
    expect(dynamoDb.query).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'im_postulaciones', IndexName: 'GSI1', ExpressionAttributeValues: { ':c': 'c1' },
    }));
    expect(resultado).toEqual([POSTULACION]);
  });

  test('obtenerPostulacion devuelve la postulaci�n por clave compuesta o 404', async () => {
    dynamoDb.get.mockResolvedValueOnce({ Item: POSTULACION });
    const resultado = await repo.obtenerPostulacion('p1', 'c1');
    expect(dynamoDb.get).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'im_postulaciones', Key: { proyectoId: 'p1', sk: 'POSTULACION#c1' },
    }));
    expect(resultado).toEqual(POSTULACION);
    dynamoDb.get.mockResolvedValueOnce({});
    await expect(repo.obtenerPostulacion('p1', 'c2')).rejects.toMatchObject({ codigo: 404 });
  });

  test('aceptarPostulacion usa TransactWriteItems y crea asignaci�n', async () => {
    dynamoDb.get.mockResolvedValueOnce({ Item: POSTULACION });
    dynamoDb.transactWrite.mockResolvedValue({});
    const resultado = await repo.aceptarPostulacion('p1', 'c1', { revisadoPor: 'admin', observacionRevision: 'OK', porcentajeDedicacion: 50, horasAsignadas: 100 });
    expect(dynamoDb.transactWrite).toHaveBeenCalledWith(expect.objectContaining({
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
    dynamoDb.get.mockResolvedValueOnce({ Item: { ...POSTULACION, estado: 'ACEPTADA' } });
    await expect(repo.aceptarPostulacion('p1', 'c1', { revisadoPor: 'admin' })).rejects.toMatchObject({ codigo: 409 });
    expect(dynamoDb.transactWrite).not.toHaveBeenCalled();
  });

  test('rechazarPostulacion cambia a RECHAZADA con revisor y fecha', async () => {
    dynamoDb.get.mockResolvedValueOnce({ Item: POSTULACION });
    dynamoDb.update.mockResolvedValue({ Attributes: { ...POSTULACION, estado: 'RECHAZADA', revisadoPor: 'admin' } });
    const resultado = await repo.rechazarPostulacion('p1', 'c1', { revisadoPor: 'admin', observacionRevision: 'No cumple' });
    
    expect(dynamoDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_postulaciones',
        Key: { proyectoId: 'p1', sk: 'POSTULACION#c1' }
      })
    );
    expect(resultado.estado).toBe('RECHAZADA');
  });

  test('retirarPostulacion cambia a RETIRADA', async () => {
    dynamoDb.get.mockResolvedValueOnce({ Item: POSTULACION });
    dynamoDb.update.mockResolvedValue({ Attributes: { ...POSTULACION, estado: 'RETIRADA', revisadoPor: 'c1' } });
    const resultado = await repo.retirarPostulacion('p1', 'c1', { revisadoPor: 'c1' });
    expect(resultado.estado).toBe('RETIRADA');
  });
});


describe('Handler: postulaciones', () => {
  test('crearPostulacion devuelve 201 con la postulaci�n', async () => {
    dynamoDb.get.mockImplementationOnce(async () => ({ Item: COLABORADOR }));
    dynamoDb.get.mockImplementationOnce(async () => ({ Item: PROYECTO }));
    dynamoDb.put.mockResolvedValue({});
    const resultado = await handler.crearPostulacion({
      body: JSON.stringify({ proyectoId: 'p1', colaboradorId: 'c1', comentario: 'Hola' }),
      pathParameters: {}, queryStringParameters: null,
    }, {});
    expect(resultado.statusCode).toBe(201);
    expect(JSON.parse(resultado.body).success).toBe(true);
  });

  test('obtenerPostulacion devuelve 404 si no existe', async () => {
    dynamoDb.get.mockResolvedValueOnce({});
    const resultado = await handler.obtenerPostulacion({
      pathParameters: { proyectoId: 'p1', colaboradorId: 'c9' },
      queryStringParameters: null,
    }, {});
    expect(resultado.statusCode).toBe(404);
    expect(JSON.parse(resultado.body).success).toBe(false);
  });

  test('rechazarPostulacion mapea el resultado del repositorio', async () => {
    dynamoDb.get.mockResolvedValueOnce({ Item: POSTULACION });
    dynamoDb.update.mockResolvedValueOnce({ Attributes: { ...POSTULACION, estado: 'RECHAZADA', revisadoPor: 'admin' } });
    const resultado = await handler.rechazarPostulacion({
      pathParameters: { proyectoId: 'p1', colaboradorId: 'c1' },
      body: JSON.stringify({ revisadoPor: 'admin', observacionRevision: 'x' }),
      queryStringParameters: null,
    }, {});
    expect(resultado.statusCode).toBe(200);
    expect(JSON.parse(resultado.body).datos.estado).toBe('RECHAZADA');
  });
});


