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
  tableAsignaciones: 'internal-marketplace-asignaciones-dev', tableColaboradores: 'internal-marketplace-colaboradores-dev', tableProyectos: 'internal-marketplace-proyectos-dev',
  tableUsuarios: 'internal-marketplace-usuarios-dev',
  tableProyectoHabilidad: 'internal-marketplace-proyecto-habilidad-dev',
  tableColaboradorHabilidad: 'internal-marketplace-colaborador-habilidad-dev',
  tablePostulaciones: 'internal-marketplace-postulaciones-dev',
}));

const { dynamoDb, commandMocks } = require('../src/config/dynamodb.js');
const cache = require('../src/services/cache.service.js');
const { ErrorApp, CODIGOS } = require('../src/utils/errors.js');
const repo = require('../src/repositories/asignaciones.repository.js');
const dedicacion = require('../src/services/dedicacion.service.js');
const handler = require('../src/functions/asignaciones/handler.js');


const COLABORADOR = { colaboradorId: 'c1', usuarioId: 'u-colaborador', estado: 'ACTIVO', disponibilidad: 'DISPONIBLE', dedicacionReservada: 0 };
const PROYECTO = { proyectoId: 'p1', liderId: 'u-lider', estado: 'ACTIVO' };

beforeEach(() => {
  dynamoDb.send.mockClear();
  cache.obtener.mockReset();
  cache.guardar.mockReset();
  cache.eliminar.mockReset();
  cache.eliminarPorPrefijo.mockReset();
  cache.obtener.mockReturnValue(undefined);
  Object.values(commandMocks).forEach((mock) => mock.mockReset());
  commandMocks.GetCommand.mockImplementation(async (input) => {
    if (input.TableName === 'internal-marketplace-proyectos-dev') return { Item: PROYECTO };
    if (input.TableName === 'internal-marketplace-colaboradores-dev') return { Item: COLABORADOR };
    if (input.TableName === 'internal-marketplace-usuarios-dev') return { Item: { usuarioId: 'u-colaborador', estado: 'ACTIVO' } };
    return {};
  });
  commandMocks.QueryCommand.mockResolvedValue({ Items: [] });
  commandMocks.ScanCommand.mockResolvedValue({ Items: [] });
  commandMocks.PutCommand.mockResolvedValue({});
  jest.spyOn(dedicacion, 'verificarHabilidadesObligatorias').mockResolvedValue({ elegible: true });
});

afterEach(() => jest.restoreAllMocks());

describe('Repositorio: asignaciones', () => {
  test('impide que el líder se asigne a su mismo proyecto, sin reservar dedicación', async () => {
    commandMocks.GetCommand.mockImplementation(async input => input.TableName === 'internal-marketplace-proyectos-dev'
      ? { Item: PROYECTO } : { Item: { ...COLABORADOR, usuarioId: PROYECTO.liderId } });
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 25, horasAsignadas: 20,
    })).rejects.toMatchObject({ codigo: 409, message: expect.stringContaining('líder de proyecto') });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('impide asignar perfiles sin identidad verificable', async () => {
    commandMocks.GetCommand.mockImplementation(async input => input.TableName === 'internal-marketplace-proyectos-dev'
      ? { Item: PROYECTO } : { Item: { ...COLABORADOR, usuarioId: undefined } });
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 25, horasAsignadas: 20,
    })).rejects.toMatchObject({ codigo: 409, message: expect.stringContaining('identidad') });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

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
  test('un perfil histórico sin dedicación inicializada devuelve 409, sin intentar transacción', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: {
      colaboradorId: 'c1', usuarioId: 'u-colaborador', estado: 'ACTIVO',
    } });
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 25,
      horasAsignadas: 20,
    })).rejects.toMatchObject({
      codigo: 409,
      message: expect.stringContaining('inicializar su dedicación'),
    });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('impide asignar otra vez al mismo colaborador al mismo proyecto, incluso si ya fue desvinculado', async () => {
    commandMocks.ScanCommand.mockResolvedValueOnce({ Items: [{
      asignacionId: 'anterior', colaboradorId: 'c1', proyectoId: 'p1', estado: 'DESVINCULADA',
    }] });
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 25, horasAsignadas: 20,
    })).rejects.toMatchObject({ codigo: 409, message: expect.stringContaining('ya tiene una asignación') });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('examina todas las páginas de la tabla base antes de aceptar una asignación histórica', async () => {
    commandMocks.ScanCommand
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { asignacionId: 'pagina-1' } })
      .mockResolvedValueOnce({ Items: [{ asignacionId: 'historica', colaboradorId: 'c1' }] });
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 25, horasAsignadas: 20,
    })).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.ScanCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'internal-marketplace-asignaciones-dev',
      ConsistentRead: true, ExclusiveStartKey: { asignacionId: 'pagina-1' },
    }));
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
      TableName: 'internal-marketplace-colaboradores-dev',
      Key: { colaboradorId: 'c1' },
    });
    expect(commandMocks.GetCommand).toHaveBeenNthCalledWith(2, {
      TableName: 'internal-marketplace-proyectos-dev',
      Key: { proyectoId: 'p1' },
    });
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'internal-marketplace-asignaciones-dev',
        IndexName: 'GSI1',
        KeyConditionExpression: expect.stringContaining('begins_with'),
      })
    );
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({ TransactItems: expect.arrayContaining([
      { Put: expect.objectContaining({ TableName: 'internal-marketplace-asignaciones-dev', Item: expect.objectContaining({ porcentajeDedicacion: 40, estado: 'ACTIVA' }), ConditionExpression: 'attribute_not_exists(asignacionId)' }) },
      { Update: expect.objectContaining({ TableName: 'internal-marketplace-proyectos-dev',
        ConditionExpression: expect.stringContaining('#lider <> :usuario'),
        ExpressionAttributeValues: expect.objectContaining({ ':usuario': 'u-colaborador', ':activo': 'ACTIVO' }),
      }) },
      { Update: expect.objectContaining({ TableName: 'internal-marketplace-colaboradores-dev', ExpressionAttributeValues: expect.objectContaining({ ':delta': 40, ':max': 60 }) }) },
      { ConditionCheck: expect.objectContaining({
        TableName: 'internal-marketplace-postulaciones-dev',
        ConditionExpression: expect.stringContaining('#estado <> :pendiente'),
      }) },
      { ConditionCheck: expect.objectContaining({
        TableName: 'internal-marketplace-usuarios-dev',
        ConditionExpression: '#estado = :activo',
      }) },
    ]) });
    expect(asignacion.asignacionId).toBeDefined();
    const { idAsignacionUnica } = require('../src/services/dedicacion.service');
    expect(asignacion.asignacionId).toBe(idAsignacionUnica('p1', 'c1'));
    expect(idAsignacionUnica('p1', 'c1')).not.toBe(idAsignacionUnica('p1', 'c2'));
    expect(cache.eliminar).toHaveBeenCalledWith(expect.stringMatching(/^asignacion:/));
    expect(cache.eliminarPorPrefijo).toHaveBeenCalledWith('asignaciones:');
  });

  test('no crea una asignación directa si aparece una postulación pendiente concurrente', async () => {
    commandMocks.TransactWriteCommand.mockRejectedValueOnce(Object.assign(
      new Error('Existe una postulación pendiente'), { name: 'TransactionCanceledException' },
    ));
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 20, horasAsignadas: 15,
    })).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { ConditionCheck: expect.objectContaining({
          TableName: 'internal-marketplace-postulaciones-dev',
          Key: { proyectoId: 'p1', postulacionKey: 'POSTULACION#c1' },
        }) },
      ]),
    });
    expect(cache.eliminarPorPrefijo).not.toHaveBeenCalled();
  });

  test('convierte un conflicto transaccional concurrente en HTTP 409 sin invalidar caché', async () => {
    commandMocks.TransactWriteCommand.mockRejectedValueOnce(Object.assign(new Error('Transacción concurrente'), {
      name: 'TransactionCanceledException',
    }));
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 60,
      horasAsignadas: 20, creadoPor: 'admin',
    })).rejects.toMatchObject({ codigo: 409, codigoError: CODIGOS.CONFLICTO });
    expect(cache.eliminarPorPrefijo).not.toHaveBeenCalled();
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
        TableName: 'internal-marketplace-asignaciones-dev',
        IndexName: 'GSI3',
        KeyConditionExpression: '#est = :est',
        ExpressionAttributeValues: { ':est': 'ACTIVA' },
      })
    );
    expect(resultado).toEqual(items);
    expect(cache.guardar).toHaveBeenCalledWith('asignaciones:activas', items, 60000);
  });

  test('listarAsignacionesColaborador consulta el GSI1 e incluye el historial', async () => {
    const items = [
      { asignacionId: 'a1', colaboradorId: 'c1', estado: 'ACTIVA' },
      { asignacionId: 'a2', colaboradorId: 'c1', estado: 'DESVINCULADA' },
    ];
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: items });
    const resultado = await repo.listarAsignacionesColaborador('c1');
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        IndexName: 'GSI1',
        KeyConditionExpression: '#c = :c',
        ExpressionAttributeNames: { '#c': 'colaboradorId' },
        ExpressionAttributeValues: { ':c': 'c1' },
      })
    );
    expect(resultado).toEqual(items);
  });

  test('listarAsignacionesProyecto consulta el GSI2 e incluye el historial', async () => {
    const items = [
      { asignacionId: 'a1', proyectoId: 'p1', estado: 'ACTIVA' },
      { asignacionId: 'a2', proyectoId: 'p1', estado: 'DESVINCULADA' },
    ];
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: items });
    const resultado = await repo.listarAsignacionesProyecto('p1');
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        IndexName: 'GSI2',
        KeyConditionExpression: '#p = :p',
        ExpressionAttributeNames: { '#p': 'proyectoId' },
        ExpressionAttributeValues: { ':p': 'p1' },
      })
    );
    expect(resultado).toEqual(items);
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
    const existente = { asignacionId: 'a1', colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 30, estado: 'ACTIVA' };
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: existente });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { ...existente, estado: 'DESVINCULADA', fechaFin: expect.anything() } });

    const resultado = await repo.desvincularAsignacion('a1');
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({ TransactItems: expect.arrayContaining([
      { Update: expect.objectContaining({ TableName: 'internal-marketplace-asignaciones-dev', Key: { asignacionId: 'a1' }, ExpressionAttributeValues: expect.objectContaining({ ':estado': 'DESVINCULADA' }) }) },
      { Update: expect.objectContaining({ TableName: 'internal-marketplace-colaboradores-dev', ExpressionAttributeValues: expect.objectContaining({ ':delta': -30 }) }) },
    ]) });
    expect(resultado.estado).toBe('DESVINCULADA');
    expect(commandMocks.DeleteCommand).not.toHaveBeenCalled();

    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { ...existente, estado: 'DESVINCULADA' } });
    await expect(repo.desvincularAsignacion('a1')).rejects.toMatchObject({ codigo: 409 });
  });

  test('finalizar asignación conserva el registro y libera la dedicación de forma transaccional', async () => {
    const existente = { asignacionId: 'a-final', colaboradorId: 'c1', proyectoId: 'p1',
      porcentajeDedicacion: 40, horasAsignadas: 40, horasCompletadas: 40, estado: 'ACTIVA' };
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: existente });
    const resultado = await repo.finalizarAsignacion('a-final');
    expect(resultado.estado).toBe('FINALIZADA');
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({
          TableName: 'internal-marketplace-asignaciones-dev',
          ExpressionAttributeValues: expect.objectContaining({ ':estado': 'FINALIZADA' }),
        }) },
        { Update: expect.objectContaining({
          TableName: 'internal-marketplace-colaboradores-dev',
          ExpressionAttributeValues: expect.objectContaining({ ':delta': -40 }),
        }) },
      ]),
    });
    expect(commandMocks.DeleteCommand).not.toHaveBeenCalled();
  });

  test.each([
    [{ horasAsignadas: -1 }, 'horas asignadas negativas'],
    [{ horasAsignadas: 5 }, 'horas asignadas menores a las completadas'],
    [{ horasCompletadas: -1 }, 'horas completadas negativas'],
    [{ horasCompletadas: 51 }, 'horas completadas superiores a las asignadas'],
  ])('rechaza %s (%s)', async cambios => {
    const existente = {
      asignacionId: 'a1', colaboradorId: 'c1', proyectoId: 'p1',
      estado: 'ACTIVA', horasAsignadas: 50, horasCompletadas: 10, porcentajeDedicacion: 30,
    };
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: existente });
    await expect(repo.actualizarAsignacion('a1', cambios)).rejects.toMatchObject({ codigo: 400 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('impide modificar una asignación finalizada', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: {
      asignacionId: 'a1', colaboradorId: 'c1', proyectoId: 'p1',
      estado: 'FINALIZADA', horasAsignadas: 50, horasCompletadas: 40, porcentajeDedicacion: 30,
    } });
    await expect(repo.actualizarAsignacion('a1', { horasCompletadas: 45 }))
      .rejects.toMatchObject({ codigo: 404 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('convierte cambios concurrentes en conflicto sin modificar la reserva', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: {
      asignacionId: 'a1', proyectoId: 'p1', colaboradorId: 'c1',
      estado: 'ACTIVA', porcentajeDedicacion: 40, horasAsignadas: 50, horasCompletadas: 10,
    } });
    commandMocks.TransactWriteCommand.mockRejectedValueOnce(Object.assign(
      new Error('Versión anterior cambió'), { name: 'TransactionCanceledException' },
    ));
    await expect(repo.actualizarAsignacion('a1', {
      porcentajeDedicacion: 60, horasAsignadas: 60,
    })).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({
          TableName: 'internal-marketplace-asignaciones-dev',
          ConditionExpression: expect.stringContaining('horasCompletadas = :completadasPrevias'),
        }) },
      ]),
    });
    expect(cache.eliminarPorPrefijo).not.toHaveBeenCalled();
  });

  test('libera el contador de actividad del proyecto al finalizar una asignación', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: {
      asignacionId: 'a1', proyectoId: 'p1', colaboradorId: 'c1',
      estado: 'ACTIVA', porcentajeDedicacion: 40,
    } });
    await repo.finalizarAsignacion('a1');
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({
          TableName: 'internal-marketplace-proyectos-dev',
          ExpressionAttributeValues: expect.objectContaining({ ':delta': -1 }),
        }) },
      ]),
    });
  });

  test('rechaza asignaciones sin habilidades obligatorias', async () => {
    dedicacion.verificarHabilidadesObligatorias.mockRejectedValueOnce(
      new ErrorApp('No cumple las habilidades obligatorias', 409, CODIGOS.CONFLICTO));
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 25,
      horasAsignadas: 20,
    })).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('rechaza asignaciones cuando la cuenta está desactivada', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'internal-marketplace-usuarios-dev') {
        return { Item: { usuarioId: 'u-colaborador', estado: 'INACTIVO' } };
      }
      return { Item: input.TableName === 'internal-marketplace-proyectos-dev' ? PROYECTO : COLABORADOR };
    });
    await expect(repo.crearAsignacion({
      colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 25, horasAsignadas: 20,
    })).rejects.toMatchObject({ codigo: 409 });
  });
});

describe('Handler: asignaciones', () => {
  test('rechaza JSON malformado sin crear asignaciones', async () => {
    const resultado = await handler.crearAsignacion({ body: '{malformado' }, {});
    expect(resultado.statusCode).toBe(400);
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

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
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { asignacionId: 'a1', colaboradorId: 'c1', proyectoId: 'p1', porcentajeDedicacion: 30, estado: 'ACTIVA' } });
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { asignacionId: 'a1', estado: 'DESVINCULADA' } });
    const resultado = await handler.desvincularAsignacion({ pathParameters: { asignacionId: 'a1' } }, {});
    expect(resultado.statusCode).toBe(200);
    expect(JSON.parse(resultado.body).datos.estado).toBe('DESVINCULADA');
  });

});








