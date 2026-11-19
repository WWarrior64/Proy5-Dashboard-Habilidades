jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);

jest.mock('../src/config/environment.js', () => ({
  tableUsuarios: 'usuarios-test',
  tableColaboradores: 'colaboradores-test',
  tableAsignaciones: 'asignaciones-test',
}));

const { commandMocks } = require('../src/config/dynamodb.js');
const usuarios = require('../src/repositories/usuarios.repository.js');

const admin = {
  usuarioId: 'admin-1', cognitoSub: 'sub-admin-1',
  email: 'admin@test.com', rol: 'ADMINISTRADOR', estado: 'ACTIVO',
};

function configurarAdministradores(totalActivos, usuario = admin) {
  commandMocks.GetCommand.mockImplementation(async input => {
    if (input.TableName === 'usuarios-test') {
      if (input.Key.usuarioId === 'CONTROL#ADMINISTRADORES_ACTIVOS') {
        return { Item: {
          usuarioId: 'CONTROL#ADMINISTRADORES_ACTIVOS',
          tipoRegistroControl: 'ADMINISTRADORES_ACTIVOS',
          totalActivos,
        } };
      }
      return { Item: usuario };
    }
    return {};
  });
  commandMocks.ScanCommand.mockResolvedValue({ Items: [] });
  commandMocks.QueryCommand.mockResolvedValue({ Items: [] });
  commandMocks.TransactWriteCommand.mockResolvedValue({});
  commandMocks.UpdateCommand.mockResolvedValue({ Attributes: usuario });
}

beforeEach(() => {
  Object.values(commandMocks).forEach(mock => mock.mockReset());
});

describe('conservación del último administrador activo', () => {
  test('impide desactivar al único administrador activo', async () => {
    configurarAdministradores(1);
    await expect(usuarios.cambiarEstado('admin-1', false))
      .rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
  });

  test('permite desactivar a un administrador cuando existen dos activos', async () => {
    configurarAdministradores(2);
    const resultado = await usuarios.cambiarEstado('admin-1', false);
    expect(resultado.estado).toBe('INACTIVO');
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({
          TableName: 'usuarios-test',
          Key: { usuarioId: 'admin-1' },
        }) },
        { Update: expect.objectContaining({
          Key: { usuarioId: 'CONTROL#ADMINISTRADORES_ACTIVOS' },
          ConditionExpression: '#total >= :minimo',
          ExpressionAttributeValues: { ':delta': -1, ':minimo': 2 },
        }) },
      ]),
    });
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
  });

  test('impide quitar el rol al último administrador activo', async () => {
    configurarAdministradores(1);
    await expect(usuarios.cambiarRol('admin-1', 'RRHH'))
      .rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('permite quitar el rol cuando hay otro administrador activo', async () => {
    configurarAdministradores(2);
    const actualizado = await usuarios.cambiarRol('admin-1', 'RRHH');
    expect(actualizado.rol).toBe('RRHH');
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({ Key: { usuarioId: 'admin-1' } }) },
        { Update: expect.objectContaining({
          Key: { usuarioId: 'CONTROL#ADMINISTRADORES_ACTIVOS' },
          ExpressionAttributeValues: { ':delta': -1, ':minimo': 2 },
        }) },
      ]),
    });
  });

  test('incrementa el contador al promover un usuario activo a administrador', async () => {
    configurarAdministradores(1, { ...admin, usuarioId: 'empleado-1', rol: 'EMPLEADO' });
    const actualizado = await usuarios.cambiarRol('empleado-1', 'ADMINISTRADOR');
    expect(actualizado.rol).toBe('ADMINISTRADOR');
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({ Key: { usuarioId: 'empleado-1' } }) },
        { Update: expect.objectContaining({
          ExpressionAttributeValues: { ':delta': 1, ':minimo': 0 },
        }) },
      ]),
    });
  });

  test('incrementa el contador al reactivar un administrador inactivo', async () => {
    configurarAdministradores(1, { ...admin, estado: 'INACTIVO' });
    const actualizado = await usuarios.cambiarEstado('admin-1', true);
    expect(actualizado.estado).toBe('ACTIVO');
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({
          ExpressionAttributeValues: expect.objectContaining({ ':nuevo': 'ACTIVO' }),
        }) },
        { Update: expect.objectContaining({
          ExpressionAttributeValues: { ':delta': 1, ':minimo': 0 },
        }) },
      ]),
    });
  });

  test('registra nuevos administradores en la misma transacción que el contador', async () => {
    configurarAdministradores(1);
    commandMocks.QueryCommand.mockResolvedValue({ Items: [] });
    await usuarios.crear({
      usuarioId: 'admin-2', cognitoSub: 'sub-admin-2',
      nombre: 'Otro administrador', email: 'otro@test.com',
      rol: 'ADMINISTRADOR', estado: 'ACTIVO',
    });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Put: expect.objectContaining({
          Item: expect.objectContaining({ usuarioId: 'admin-2', rol: 'ADMINISTRADOR' }),
        }) },
        { Update: expect.objectContaining({
          ExpressionAttributeValues: { ':delta': 1, ':minimo': 0 },
        }) },
      ]),
    });
  });

  test('no permite modificar el rol desde la actualización genérica', async () => {
    configurarAdministradores(1);
    await expect(usuarios.actualizar('admin-1', { rol: 'RRHH' }))
      .rejects.toMatchObject({ codigo: 400 });
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
  });

  test('la segunda desactivación concurrente queda rechazada', async () => {
    let disponibles = 2;
    configurarAdministradores(disponibles);
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'usuarios-test' &&
          input.Key.usuarioId === 'CONTROL#ADMINISTRADORES_ACTIVOS') {
        return { Item: { totalActivos: disponibles } };
      }
      if (input.TableName === 'usuarios-test') {
        return { Item: { ...admin, usuarioId: input.Key.usuarioId } };
      }
      return {};
    });
    commandMocks.TransactWriteCommand.mockImplementation(async () => {
      disponibles -= 1;
      return {};
    });
    await usuarios.cambiarEstado('admin-1', false);
    await expect(usuarios.cambiarEstado('admin-2', false))
      .rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledTimes(1);
  });

  test('inicializa el control con los administradores activos históricos', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.Key.usuarioId === 'CONTROL#ADMINISTRADORES_ACTIVOS') return {};
      if (input.TableName === 'usuarios-test') return { Item: admin };
      return {};
    });
    commandMocks.ScanCommand.mockResolvedValueOnce({
      Items: [admin], LastEvaluatedKey: { usuarioId: 'admin-1' },
    }).mockResolvedValueOnce({ Items: [{ ...admin, usuarioId: 'admin-2' }] });
    commandMocks.PutCommand.mockResolvedValue({});
    await usuarios.cambiarRol('admin-1', 'RRHH');
    expect(commandMocks.PutCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'usuarios-test',
      Item: expect.objectContaining({
        usuarioId: 'CONTROL#ADMINISTRADORES_ACTIVOS',
        totalActivos: 2,
      }),
      ConditionExpression: 'attribute_not_exists(usuarioId)',
    }));
    expect(commandMocks.ScanCommand).toHaveBeenCalledTimes(2);
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledTimes(1);
  });

  test('oculta el registro interno de control en los listados de usuarios', async () => {
    commandMocks.ScanCommand.mockResolvedValue({ Items: [admin], LastEvaluatedKey: null });
    const listado = await usuarios.listar();
    expect(listado.items).toEqual([admin]);
    expect(commandMocks.ScanCommand).toHaveBeenCalledWith(expect.objectContaining({
      FilterExpression: 'attribute_not_exists(#control)',
    }));
  });
});
