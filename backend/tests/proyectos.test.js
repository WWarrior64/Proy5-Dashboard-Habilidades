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
  tableProyectos: 'internal-marketplace-proyectos-dev',
  tableUsuarios: 'internal-marketplace-usuarios-dev',
  tableAsignaciones: 'internal-marketplace-asignaciones-dev',
  tableProyectoHabilidad: 'internal-marketplace-proyecto-habilidad-dev',
}));

const { dynamoDb, commandMocks } = require('../src/config/dynamodb.js');
const cache = require('../src/services/cache.service.js');
const { ErrorApp, CODIGOS } = require('../src/utils/errors.js');
const repo = require('../src/repositories/proyectos.repository.js');
const handler = require('../src/functions/proyectos/handler.js');

const LIDER = { usuarioId: 'u-lider', rol: 'LIDER_PROYECTO', estado: 'ACTIVO' };

beforeEach(() => {
  dynamoDb.send.mockClear();
  commandMocks.GetCommand.mockReset();
  commandMocks.PutCommand.mockReset();
  commandMocks.UpdateCommand.mockReset();
  commandMocks.DeleteCommand.mockReset();
  commandMocks.QueryCommand.mockReset();
  commandMocks.ScanCommand.mockReset();
  commandMocks.TransactWriteCommand.mockReset();
  cache.obtener.mockReset();
  cache.guardar.mockReset();
  cache.eliminar.mockReset();
  cache.eliminarPorPrefijo.mockReset();
  cache.obtener.mockReturnValue(undefined);
});

describe('Repositorio: proyectos', () => {
  test('handler rechaza cuerpos JSON malformados antes de acceder al repositorio', async () => {
    const respuesta = await handler.crearProyecto({ body: '{invalido' }, {});
    expect(respuesta.statusCode).toBe(400);
    expect(commandMocks.PutCommand).not.toHaveBeenCalled();
  });

  test('la API de proyectos entrega el nombre del líder para el Empleado, sin exponer su correo', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({
      Items: [{ proyectoId: 'p1', nombre: 'Modernización de plataforma Cloud',
        estado: 'ACTIVO', liderId: 'u-lider' }],
    });
    commandMocks.GetCommand.mockResolvedValueOnce({
      Item: { usuarioId: 'u-lider', nombre: 'Diego Ernestos', email: 'privado@empresa.test' },
    });

    const respuesta = await handler.listarProyectos({
      queryStringParameters: { estado: 'ACTIVO' },
    }, {});
    expect(respuesta.statusCode).toBe(200);
    const proyecto = JSON.parse(respuesta.body).datos[0];
    expect(proyecto.liderNombre).toBe('Diego Ernestos');
    expect(proyecto.email).toBeUndefined();
    expect(commandMocks.GetCommand).toHaveBeenCalledWith({
      TableName: 'internal-marketplace-usuarios-dev',
      Key: { usuarioId: 'u-lider' },
    });
  });

  test('consultar un proyecto existente también resuelve el nombre de su líder', async () => {
    commandMocks.GetCommand
      .mockResolvedValueOnce({ Item: { proyectoId: 'p2', nombre: 'API interna', liderId: 'u-lider' } })
      .mockResolvedValueOnce({ Item: { usuarioId: 'u-lider', nombre: 'Diego Ernestos' } });
    const respuesta = await handler.obtenerProyecto({ pathParameters: { proyectoId: 'p2' } }, {});
    expect(respuesta.statusCode).toBe(200);
    expect(JSON.parse(respuesta.body).datos.liderNombre).toBe('Diego Ernestos');
  });

  test('registra un proyecto con líder válido, horas positivas y estado BORRADOR por defecto', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: LIDER });
    commandMocks.PutCommand.mockResolvedValue({});

    const proyecto = await repo.crearProyecto({
      nombre: 'Sistema de tesis',
      descripcion: 'Plataforma de gestión',
      liderId: 'u-lider',
      horasRequeridas: 120,
      creadoPor: 'admin',
    });

    expect(commandMocks.GetCommand).toHaveBeenCalledWith({
      TableName: 'internal-marketplace-usuarios-dev',
      Key: { usuarioId: 'u-lider' },
    });
    expect(commandMocks.PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'internal-marketplace-proyectos-dev',
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
    expect(proyecto.fechaPublicacion).toBeUndefined();
    expect(cache.eliminar).toHaveBeenCalledWith(expect.stringMatching(/^proyecto:/));
    expect(cache.eliminarPorPrefijo).toHaveBeenCalledWith('proyectos:list:');
  });

  test('impide crear directamente un proyecto publicado sin registrar sus requisitos', async () => {
    await expect(repo.crearProyecto({
      nombre: 'Proyecto sin habilidades', descripcion: 'Prueba', liderId: 'u-lider',
      horasRequeridas: 40, creadoPor: 'admin', estado: 'ACTIVO',
    })).rejects.toMatchObject({ codigo: 400, message: expect.stringContaining('BORRADOR') });
    expect(commandMocks.PutCommand).not.toHaveBeenCalled();
  });

  test('impide activar un proyecto si todavía no tiene habilidades requeridas', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [] });
    await expect(repo.actualizarProyecto('p1', { estado: 'ACTIVO' }))
      .rejects.toMatchObject({ codigo: 400, message: expect.stringContaining('habilidad requerida') });
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'internal-marketplace-proyecto-habilidad-dev',
      ConsistentRead: true, Limit: 1,
    }));
  });

  test('registra la fecha real de publicación cuando el borrador pasa a activo', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [{ habilidadId: 'hab-1' }] });
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { proyectoId: 'p1', estado: 'BORRADOR' } });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', estado: 'ACTIVO' } });
    const proyecto = await repo.cambiarEstado('p1', 'ACTIVO');
    expect(proyecto.estado).toBe('ACTIVO');
    expect(commandMocks.UpdateCommand).toHaveBeenCalledWith(expect.objectContaining({
      UpdateExpression: expect.stringContaining('#fp = :fp'),
      ExpressionAttributeValues: expect.objectContaining({ ':fp': expect.any(String), ':fpk': expect.stringContaining('#p1') }),
    }));
  });

  test('mantiene la fecha de publicación al editar un proyecto ya activo', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [{ habilidadId: 'hab-1' }] });
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { proyectoId: 'p1', estado: 'ACTIVO', fechaPublicacion: '2026-11-05T10:00:00.000Z' } });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', estado: 'ACTIVO' } });
    await repo.actualizarProyecto('p1', { nombre: 'Proyecto editado', estado: 'ACTIVO' });
    expect(commandMocks.UpdateCommand.mock.calls[0][0].UpdateExpression).not.toContain('#fp');
  });

  test('rechaza horas requeridas no positivas sin escribir en la tabla', async () => {
    await expect(
      repo.crearProyecto({ nombre: 'X', descripcion: 'D', liderId: 'u-lider', horasRequeridas: 0, creadoPor: 'admin' })
    ).rejects.toMatchObject({ codigo: 400, codigoError: CODIGOS.VALIDACION, name: 'ErrorApp' });
    expect(commandMocks.PutCommand).not.toHaveBeenCalled();
  });

  test('rechaza líder que no tiene el rol LIDER_PROYECTO', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { usuarioId: 'u-emp', rol: 'EMPLEADO', estado: 'ACTIVO' } });
    await expect(repo.crearProyecto({ nombre: 'X', descripcion: 'D', liderId: 'u-emp', horasRequeridas: 10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 400, codigoError: CODIGOS.VALIDACION });
    expect(commandMocks.PutCommand).not.toHaveBeenCalled();
  });

  test('rechaza líder inexistente', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({});
    await expect(repo.crearProyecto({ nombre: 'X', descripcion: 'D', liderId: 'u-nulo', horasRequeridas: 10, creadoPor: 'admin' }))
      .rejects.toMatchObject({ codigo: 404, codigoError: CODIGOS.NO_ENCONTRADO });
  });

  test('consulta un proyecto por proyectoId y lo cachea', async () => {
    const item = { proyectoId: 'p1', nombre: 'Proy', estado: 'ACTIVO' };
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: item });
    const resultado = await repo.obtenerProyecto('p1');
    expect(commandMocks.GetCommand).toHaveBeenCalledWith({ TableName: 'internal-marketplace-proyectos-dev', Key: { proyectoId: 'p1' } });
    expect(resultado).toEqual(item);
    expect(cache.guardar).toHaveBeenCalledWith('proyecto:p1', item, 60000);
  });

  test('consulta un proyecto desde caché sin llamar a DynamoDB', async () => {
    const item = { proyectoId: 'p1', nombre: 'Proy' };
    cache.obtener.mockReturnValueOnce(item);
    const resultado = await repo.obtenerProyecto('p1');
    expect(resultado).toEqual(item);
    expect(commandMocks.GetCommand).not.toHaveBeenCalled();
  });

  test('obtenerProyecto lanza 404 si no existe', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({});
    await expect(repo.obtenerProyecto('p-noexiste')).rejects.toMatchObject({ codigo: 404 });
  });

  test('lista proyectos por estado usando GSI1', async () => {
    const items = [{ proyectoId: 'p1', estado: 'ACTIVO' }];
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: items });
    const resultado = await repo.listarProyectos({ estado: 'ACTIVO' });
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'internal-marketplace-proyectos-dev',
        IndexName: 'GSI1',
        KeyConditionExpression: '#est = :est',
        ExpressionAttributeValues: { ':est': 'ACTIVO' },
      })
    );
    expect(resultado).toEqual(items);
    expect(cache.guardar).toHaveBeenCalledWith('proyectos:list:ACTIVO', items, 60000);
  });

  test('lista proyectos por líder y filtra por estado y fecha usando GSI2', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [] });
    await repo.listarProyectos({ liderId: 'u-lider', estado: 'ACTIVO', fecha: '2026-01-01' });
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'internal-marketplace-proyectos-dev',
        IndexName: 'GSI2',
        KeyConditionExpression: '#lid = :lid',
        ExpressionAttributeValues: { ':lid': 'u-lider', ':est': 'ACTIVO', ':fecha': '2026-01-01' },
        FilterExpression: '#est = :est AND #fp >= :fecha',
      })
    );
  });

  test('listarProyectos sin filtros recorre las cinco particiones de estado mediante GSI1', async () => {
    commandMocks.QueryCommand.mockResolvedValue({ Items: [] });
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [{ proyectoId: 'p1', estado: 'BORRADOR' }] });
    const resultado = await repo.listarProyectos({});
    expect(resultado).toEqual([{ proyectoId: 'p1', estado: 'BORRADOR' }]);
    expect(commandMocks.QueryCommand).toHaveBeenCalledTimes(5);
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
      IndexName: 'GSI1',
      ExpressionAttributeValues: { ':est': 'BORRADOR' },
    }));
  });

  test('listarProyectos devuelve caché sin consultar DynamoDB', async () => {
    const items = [{ proyectoId: 'p1' }];
    cache.obtener.mockReturnValueOnce(items);
    const resultado = await repo.listarProyectos({ estado: 'ACTIVO' });
    expect(resultado).toEqual(items);
    expect(commandMocks.QueryCommand).not.toHaveBeenCalled();
  });

  test('actualizarProyecto modifica campos y valida horas', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: LIDER });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', nombre: 'Nuevo', estado: 'ACTIVO' } });
    const resultado = await repo.actualizarProyecto('p1', { nombre: 'Nuevo', horasRequeridas: 200 });
    expect(commandMocks.UpdateCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'internal-marketplace-proyectos-dev',
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
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
  });

  test('actualizarProyecto lanza 404 cuando el proyecto no existe', async () => {
    commandMocks.UpdateCommand.mockRejectedValueOnce(Object.assign(new Error('Condicional'), { name: 'ConditionalCheckFailedException' }));
    await expect(repo.actualizarProyecto('p-noexiste', { nombre: 'Nuevo' })).rejects.toMatchObject({ codigo: 404 });
  });

  test('cambiarEstado valida estados y actualiza el ítem sin eliminarlo', async () => {
    await expect(repo.cambiarEstado('p1', 'ESTADO_INEXISTENTE')).rejects.toMatchObject({ codigo: 400 });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', estado: 'CANCELADO' } });
    const resultado = await repo.cambiarEstado('p1', 'CANCELADO');
    expect(commandMocks.UpdateCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'internal-marketplace-proyectos-dev',
        Key: { proyectoId: 'p1' },
        ExpressionAttributeValues: expect.objectContaining({ ':est': 'CANCELADO' }),
      })
    );
    expect(resultado.estado).toBe('CANCELADO');
    expect(cache.eliminar).toHaveBeenCalledWith('proyecto:p1');
  });

  test('cancelarProyecto bloquea el cierre si existen asignaciones activas', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [{ asignacionId: 'asig-1', estado: 'ACTIVA' }] });
    await expect(repo.cancelarProyecto('p1')).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'internal-marketplace-asignaciones-dev',
      IndexName: 'GSI2',
      ExpressionAttributeValues: { ':p': 'p1', ':activa': 'ACTIVA#' },
    }));
  });

  test('cancelarProyecto cambia a CANCELADO y conserva el registro', async () => {
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', estado: 'CANCELADO' } });
    const resultado = await repo.cancelarProyecto('p1');
    expect(commandMocks.UpdateCommand).toHaveBeenCalled();
    expect(resultado.estado).toBe('CANCELADO');
    expect(commandMocks.DeleteCommand).not.toHaveBeenCalled();
  });

  test('listarProyectosActivos consulta proyectos ACTIVO por GSI1', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [{ proyectoId: 'p1', estado: 'ACTIVO' }] });
    const resultado = await repo.listarProyectosActivos();
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: 'internal-marketplace-proyectos-dev', IndexName: 'GSI1', ExpressionAttributeValues: { ':est': 'ACTIVO' } })
    );
    expect(resultado.length).toBe(1);
  });
});

describe('Handler: proyectos', () => {
  test('crearProyecto devuelve respuesta creada (201) con el proyecto', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: LIDER });
    commandMocks.PutCommand.mockResolvedValue({});
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
    commandMocks.GetCommand.mockResolvedValue({ Item: { proyectoId: 'p1', nombre: 'Proy' } });
    const ok = await handler.obtenerProyecto({ pathParameters: { proyectoId: 'p1' } }, {});
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body).success).toBe(true);
    expect(JSON.parse(ok.body).datos.proyectoId).toBe('p1');
  });

  test('obtenerProyecto devuelve error 404 cuando no existe', async () => {
    commandMocks.GetCommand.mockResolvedValue({});
    const fallo = await handler.obtenerProyecto({ pathParameters: { proyectoId: 'p-no' } }, {});
    expect(fallo.statusCode).toBe(404);
    expect(JSON.parse(fallo.body).success).toBe(false);
  });

  test('listarProyectos envía filtros al repositorio', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [] });
    const resultado = await handler.listarProyectos({
      queryStringParameters: { estado: 'ACTIVO', liderId: 'u-lider' },
    }, {});
    expect(resultado.statusCode).toBe(200);
    expect(JSON.parse(resultado.body).success).toBe(true);
    expect(commandMocks.QueryCommand).toHaveBeenCalled();
  });

  test('cancelarProyecto mapea el resultado del repositorio a respuesta Lambda', async () => {
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { proyectoId: 'p1', estado: 'CANCELADO' } });
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
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
  });
});