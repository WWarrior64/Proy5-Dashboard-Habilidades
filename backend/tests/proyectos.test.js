jest.mock('../src/config/dynamodb.js', () => {
  const m = {
    get: jest.fn(),
    put: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    query: jest.fn(),
    scan: jest.fn(),
    transactWrite: jest.fn(),
  };
  return { dynamoDb: m, client: {} };
}, { virtual: true });

jest.mock('../src/services/cache.service.js', () => ({
  obtener: jest.fn(() => undefined),
  guardar: jest.fn(),
  eliminar: jest.fn(() => true),
  eliminarPorPrefijo: jest.fn(() => 0),
  construirClave: (...partes) => partes.filter(Boolean).join(':'),
}));

jest.mock('../src/config/environment.js', () => ({
  tableProyectos: 'im_proyectos',
  tableUsuarios: 'im_usuarios',
}));

const { dynamoDb } = require('../src/config/dynamodb.js');
const cache = require('../src/services/cache.service.js');
const { ErrorApp, CODIGOS } = require('../src/utils/errors.js');
const repo = require('../src/repositories/proyectos.repository.js');
const handler = require('../src/functions/proyectos/handler.js');

const LIDER = { usuarioId: 'u-lider', rol: 'LIDER_PROYECTO', estado: 'ACTIVO' };

beforeEach(() => {
  dynamoDb.get.mockReset();
  dynamoDb.put.mockReset();
  dynamoDb.update.mockReset();
  dynamoDb.delete.mockReset();
  dynamoDb.query.mockReset();
  dynamoDb.scan.mockReset();
  dynamoDb.transactWrite.mockReset();
  cache.obtener.mockReset();
  cache.guardar.mockReset();
  cache.eliminar.mockReset();
  cache.eliminarPorPrefijo.mockReset();
  cache.obtener.mockReturnValue(undefined);
});

describe('Repositorio: proyectos', () => {
  test('registra un proyecto con líder válido, horas positivas y estado BORRADOR por defecto', async () => {
    dynamoDb.get.mockResolvedValueOnce({ Item: LIDER });
    dynamoDb.put.mockResolvedValue({});

    const proyecto = await repo.crearProyecto({
      nombre: 'Sistema de tesis',
      descripcion: 'Plataforma de gestión',
      liderId: 'u-lider',
      horasRequeridas: 120,
      creadoPor: 'admin',
    });

    expect(dynamoDb.get).toHaveBeenCalledWith({
      TableName: 'im_usuarios',
      Key: { usuarioId: 'u-lider' },
    });
    expect(dynamoDb.put).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_proyectos',
        Item: expect.objectContaining({
          nombre: 'Sistema de tesis',
          liderId: 'u-lider',
          horasRequeridas: 120,
          estado: 'BORRADOR',
        }),
        ConditionExpression: 'attribute_not_exists(proyectoId)',
      })
    );
    expect(typeof proyecto.proyectoId).toBe('string');
    expect(cache.eliminar).toHaveBeenCalledWith(expect.stringMatching(/^proyecto:/));
    expect(cache.eliminarPorPrefijo).toHaveBeenCalledWith('proyectos:list:');
  });

  test('rechaza horas requeridas no positivas sin escribir en la tabla', async () => {
    await expect(
      repo.crearProyecto({ nombre: 'X', descripcion: 'D', liderId: 'u-lider', horasRequeridas: 0, creadoPor: 'admin' })
    ).rejects.toMatchObject({ codigo: 400, codigoError: CODIGOS.VALIDACION, name: 'ErrorApp' });
    expect(dynamoDb.put).not.toHaveBeenCalled();
  });

  test('rechaza líder que no tiene el rol LIDER_PROYECTO', async () => {
    dynamoDb.get.mockResolvedValueOnce({ Item: { usuarioId: 'u-emp', rol: 'EMPLEADO', estado: 'ACTIVO' } });
    await expect(repo.crearProyecto({ nombre: 'X', descripcion: 'D', liderId: 'u-emp', horasRequeridas: 10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 400, codigoError: CODIGOS.VALIDACION });
    expect(dynamoDb.put).not.toHaveBeenCalled();
  });

  test('rechaza líder inexistente', async () => {
    dynamoDb.get.mockResolvedValueOnce({});
    await expect(repo.crearProyecto({ nombre: 'X', descripcion: 'D', liderId: 'u-nulo', horasRequeridas: 10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 404, codigoError: CODIGOS.NO_ENCONTRADO });
  });

  test('consulta un proyecto por proyectoId y lo cachea', async () => {
    const item = { proyectoId: 'p1', nombre: 'Proy', estado: 'ACTIVO' };
    dynamoDb.get.mockResolvedValueOnce({ Item: item });
    const resultado = await repo.obtenerProyecto('p1');
    expect(dynamoDb.get).toHaveBeenCalledWith({ TableName: 'im_proyectos', Key: { proyectoId: 'p1' } });
    expect(resultado).toEqual(item);
    expect(cache.guardar).toHaveBeenCalledWith('proyecto:p1', item, 60000);
  });

  test('consulta un proyecto desde caché sin llamar a DynamoDB', async () => {
    const item = { proyectoId: 'p1', nombre: 'Proy' };
    cache.obtener.mockReturnValueOnce(item);
    const resultado = await repo.obtenerProyecto('p1');
    expect(resultado).toEqual(item);
    expect(dynamoDb.get).not.toHaveBeenCalled();
  });

  test('obtenerProyecto lanza 404 si no existe', async () => {
    dynamoDb.get.mockResolvedValueOnce({});
    await expect(repo.obtenerProyecto('p-noexiste')).rejects.toMatchObject({ codigo: 404 });
  });

  test('lista proyectos por estado usando GSI1', async () => {
    const items = [{ proyectoId: 'p1', estado: 'ACTIVO' }];
    dynamoDb.query.mockResolvedValueOnce({ Items: items });
    const resultado = await repo.listarProyectos({ estado: 'ACTIVO' });
    expect(dynamoDb.query).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_proyectos',
        IndexName: 'GSI1',
        KeyConditionExpression: '#est = :est',
        ExpressionAttributeValues: { ':est': 'ACTIVO' },
      })
    );
    expect(resultado).toEqual(items);
    expect(cache.guardar).toHaveBeenCalledWith('proyectos:list:ACTIVO', items, 60000);
  });

  test('lista proyectos por líder y filtra por estado y fecha usando GSI2', async () => {
    dynamoDb.query.mockResolvedValueOnce({ Items: [] });
    await repo.listarProyectos({ liderId: 'u-lider', estado: 'ACTIVO', fecha: '2026-01-01' });
    expect(dynamoDb.query).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_proyectos',
        IndexName: 'GSI2',
        KeyConditionExpression: '#lid = :lid',
        ExpressionAttributeValues: { ':lid': 'u-lider', ':est': 'ACTIVO', ':fecha': '2026-01-01' },
        FilterExpression: '#est = :est AND #fp >= :fecha',
      })
    );
  });

  test('listarProyectos requiere al menos un filtro', async () => {
    await expect(repo.listarProyectos({})).rejects.toMatchObject({ codigo: 400 });
    expect(dynamoDb.query).not.toHaveBeenCalled();
  });

  test('listarProyectos devuelve caché sin consultar DynamoDB', async () => {
    const items = [{ proyectoId: 'p1' }];
    cache.obtener.mockReturnValueOnce(items);
    const resultado = await repo.listarProyectos({ estado: 'ACTIVO' });
    expect(resultado).toEqual(items);
    expect(dynamoDb.query).not.toHaveBeenCalled();
  });

  test('actualizarProyecto modifica campos y valida horas', async () => {
    dynamoDb.get.mockResolvedValueOnce({ Item: LIDER });
    dynamoDb.update.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', nombre: 'Nuevo', estado: 'ACTIVO' } });
    const resultado = await repo.actualizarProyecto('p1', { nombre: 'Nuevo', horasRequeridas: 200 });
    expect(dynamoDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_proyectos',
        Key: { proyectoId: 'p1' },
        ConditionExpression: 'attribute_exists(proyectoId)',
        UpdateExpression: expect.stringContaining('SET'),
      })
    );
    expect(resultado.nombre).toBe('Nuevo');
    expect(cache.eliminarPorPrefijo).toHaveBeenCalledWith('proyectos:list:');
  });

  test('actualizarProyecto rechaza horas requeridas no positivas', async () => {
    await expect(repo.actualizarProyecto('p1', { horasRequeridas: -5 })).rejects.toMatchObject({ codigo: 400 });
    expect(dynamoDb.update).not.toHaveBeenCalled();
  });

  test('actualizarProyecto lanza 404 cuando el proyecto no existe', async () => {
    dynamoDb.update.mockRejectedValueOnce(Object.assign(new Error('Condicional'), { name: 'ConditionalCheckFailedException' }));
    await expect(repo.actualizarProyecto('p-noexiste', { nombre: 'Nuevo' })).rejects.toMatchObject({ codigo: 404 });
  });

  test('cambiarEstado valida estados y actualiza el ítem sin eliminarlo', async () => {
    await expect(repo.cambiarEstado('p1', 'ESTADO_INEXISTENTE')).rejects.toMatchObject({ codigo: 400 });
    dynamoDb.update.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', estado: 'CANCELADO' } });
    const resultado = await repo.cambiarEstado('p1', 'CANCELADO');
    expect(dynamoDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'im_proyectos',
        Key: { proyectoId: 'p1' },
        ExpressionAttributeValues: expect.objectContaining({ ':est': 'CANCELADO' }),
      })
    );
    expect(resultado.estado).toBe('CANCELADO');
    expect(cache.eliminar).toHaveBeenCalledWith('proyecto:p1');
  });

  test('cancelarProyecto cambia a CANCELADO y conserva el registro', async () => {
    dynamoDb.update.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', estado: 'CANCELADO' } });
    const resultado = await repo.cancelarProyecto('p1');
    expect(dynamoDb.update).toHaveBeenCalled();
    expect(resultado.estado).toBe('CANCELADO');
    expect(dynamoDb.delete).not.toHaveBeenCalled();
  });

  test('listarProyectosActivos consulta proyectos ACTIVO por GSI1', async () => {
    dynamoDb.query.mockResolvedValueOnce({ Items: [{ proyectoId: 'p1', estado: 'ACTIVO' }] });
    const resultado = await repo.listarProyectosActivos();
    expect(dynamoDb.query).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: 'im_proyectos', IndexName: 'GSI1', ExpressionAttributeValues: { ':est': 'ACTIVO' } })
    );
    expect(resultado.length).toBe(1);
  });
});

describe('Handler: proyectos', () => {
  test('crearProyecto devuelve respuesta creada (201) con el proyecto', async () => {
    dynamoDb.get.mockResolvedValueOnce({ Item: LIDER });
    dynamoDb.put.mockResolvedValue({});
    const resultado = await handler.crearProyecto({
      body: JSON.stringify({ nombre: 'X', descripcion: 'D', liderId: 'u-lider', horasRequeridas: 10, creadoPor: 'admin' }),
      pathParameters: {},
      queryStringParameters: null,
    }, {});
    expect(resultado.statusCode).toBe(201);
    const cuerpo = JSON.parse(resultado.body);
    expect(cuerpo.success).toBe(true);
    expect(cuerpo.datos.nombre).toBe('X');
  });

  test('obtenerProyecto devuelve el proyecto cuando existe', async () => {
    dynamoDb.get.mockResolvedValue({ Item: { proyectoId: 'p1', nombre: 'Proy' } });
    const ok = await handler.obtenerProyecto({ pathParameters: { proyectoId: 'p1' } }, {});
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body).success).toBe(true);
    expect(JSON.parse(ok.body).datos.proyectoId).toBe('p1');
  });

  test('obtenerProyecto devuelve error 404 cuando no existe', async () => {
    dynamoDb.get.mockResolvedValue({});
    const fallo = await handler.obtenerProyecto({ pathParameters: { proyectoId: 'p-no' } }, {});
    expect(fallo.statusCode).toBe(404);
    expect(JSON.parse(fallo.body).success).toBe(false);
  });

  test('listarProyectos envía filtros al repositorio', async () => {
    dynamoDb.query.mockResolvedValueOnce({ Items: [] });
    const resultado = await handler.listarProyectos({
      queryStringParameters: { estado: 'ACTIVO', liderId: 'u-lider' },
    }, {});
    expect(resultado.statusCode).toBe(200);
    expect(JSON.parse(resultado.body).success).toBe(true);
    expect(dynamoDb.query).toHaveBeenCalled();
  });

  test('cancelarProyecto mapea el resultado del repositorio a respuesta Lambda', async () => {
    dynamoDb.update.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', estado: 'CANCELADO' } });
    const resultado = await handler.cancelarProyecto({ pathParameters: { proyectoId: 'p1' } }, {});
    expect(resultado.statusCode).toBe(200);
    expect(JSON.parse(resultado.body).success).toBe(true);
  });

  test('cambiarEstado rechaza estados inválidos antes de escribir', async () => {
    const resultado = await handler.cambiarEstadoProyecto({
      pathParameters: { proyectoId: 'p1' },
      body: JSON.stringify({ estado: 'INVALIDO' }),
    }, {});
    expect(resultado.statusCode).toBe(400);
    expect(JSON.parse(resultado.body).success).toBe(false);
    expect(dynamoDb.update).not.toHaveBeenCalled();
  });
});