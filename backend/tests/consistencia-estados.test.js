jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);

jest.mock('../src/config/environment.js', () => ({
  tableUsuarios: 'usuarios-test', tableColaboradores: 'colaboradores-test',
  tableAsignaciones: 'asignaciones-test', tableCargos: 'cargos-test',
}));

const { commandMocks } = require('../src/config/dynamodb.js');
const usuarios = require('../src/repositories/usuarios.repository.js');
const colaboradores = require('../src/repositories/colaboradores.repository.js');

const USUARIO = { usuarioId: 'u1', estado: 'ACTIVO', nombre: 'Ana' };
const PERFIL = {
  colaboradorId: 'c1', usuarioId: 'u1', estado: 'ACTIVO',
  dedicacionReservada: 0, fechaBaja: null,
};

beforeEach(() => {
  Object.values(commandMocks).forEach(mock => mock.mockReset());
  commandMocks.GetCommand.mockImplementation(async input => {
    if (input.TableName === 'usuarios-test') return { Item: USUARIO };
    if (input.Key.colaboradorId === 'USUARIO#u1') {
      return { Item: { propietarioColaboradorId: 'c1' } };
    }
    return { Item: PERFIL };
  });
  commandMocks.QueryCommand.mockResolvedValue({ Items: [] });
  commandMocks.ScanCommand.mockResolvedValue({ Items: [] });
  commandMocks.UpdateCommand.mockResolvedValue({ Attributes: { ...USUARIO, estado: 'INACTIVO' } });
  commandMocks.TransactWriteCommand.mockResolvedValue({});
});

describe('W04: estado de cuentas y perfiles vinculados', () => {
  test('desactiva usuario y perfil en una sola transacción y conserva la baja', async () => {
    const resultado = await usuarios.cambiarEstado('u1', false);
    expect(resultado.estado).toBe('INACTIVO');
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({
          TableName: 'usuarios-test',
          ConditionExpression: expect.stringContaining('#estado = :anterior'),
        }) },
        { Update: expect.objectContaining({
          TableName: 'colaboradores-test',
          ConditionExpression: expect.stringContaining('dedicacionReservada = :cero'),
          UpdateExpression: expect.stringContaining('#baja = :fecha'),
        }) },
      ]),
    });
  });

  test('rechaza una cuenta con dedicación activa sin modificar ninguna tabla', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'usuarios-test') return { Item: USUARIO };
      if (input.Key.colaboradorId === 'USUARIO#u1') return { Item: { propietarioColaboradorId: 'c1' } };
      return { Item: { ...PERFIL, dedicacionReservada: 40 } };
    });
    await expect(usuarios.cambiarEstado('u1', false)).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('rechaza desactivar una cuenta si el índice aún muestra asignaciones activas', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [{ asignacionId: 'a1' }] });
    await expect(usuarios.cambiarEstado('u1', false)).rejects.toMatchObject({ codigo: 409 });
  });

  test('convierte un conflicto concurrente de desactivación en 409', async () => {
    commandMocks.TransactWriteCommand.mockRejectedValueOnce(Object.assign(
      new Error('Concurrente'), { name: 'TransactionCanceledException' },
    ));
    await expect(usuarios.cambiarEstado('u1', false)).rejects.toMatchObject({ codigo: 409 });
  });

  test('W04 encuentra un perfil histórico sin reserva mediante Scan consistente y desactiva ambos registros', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'usuarios-test') return { Item: USUARIO };
      if (input.Key.colaboradorId === 'USUARIO#u1') return {};
      return { Item: PERFIL };
    });
    commandMocks.ScanCommand.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { colaboradorId: 'pagina-1' } })
      .mockResolvedValueOnce({ Items: [PERFIL] });
    const resultado = await usuarios.cambiarEstado('u1', false);
    expect(resultado.estado).toBe('INACTIVO');
    expect(commandMocks.ScanCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'colaboradores-test',
      ConsistentRead: true,
      ExclusiveStartKey: { colaboradorId: 'pagina-1' },
    }));
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Update: expect.objectContaining({ TableName: 'usuarios-test' }) },
        { Update: expect.objectContaining({ TableName: 'colaboradores-test' }) },
      ]),
    });
  });

  test('W04 rechaza perfiles históricos duplicados y no desactiva la cuenta', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'usuarios-test') return { Item: USUARIO };
      if (input.Key.colaboradorId === 'USUARIO#u1') return {};
      return { Item: PERFIL };
    });
    commandMocks.ScanCommand.mockResolvedValueOnce({ Items: [PERFIL], LastEvaluatedKey: { colaboradorId: 'p1' } })
      .mockResolvedValueOnce({ Items: [{ ...PERFIL, colaboradorId: 'c2' }] });
    await expect(usuarios.cambiarEstado('u1', false)).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
  });

  test('reactiva la cuenta sin reincorporar automáticamente el perfil', async () => {
    commandMocks.UpdateCommand.mockResolvedValueOnce({ Attributes: { ...USUARIO, estado: 'ACTIVO' } });
    const resultado = await usuarios.cambiarEstado('u1', true);
    expect(resultado.estado).toBe('ACTIVO');
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
    expect(commandMocks.UpdateCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'usuarios-test',
      ExpressionAttributeValues: expect.objectContaining({ ':nuevo': 'ACTIVO' }),
    }));
  });
});

describe('W04: impedir perfiles nuevos sobre cuentas inactivadas o históricas', () => {
  test('la creación exige que la cuenta permanezca activa en la misma transacción', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'usuarios-test') return { Item: USUARIO };
      if (input.TableName === 'cargos-test') return { Item: { cargoId: 'cargo1', estado: 'ACTIVO' } };
      if (input.Key.colaboradorId === 'USUARIO#u1') return {};
      return {};
    });
    await colaboradores.crear({ usuarioId: 'u1', cargoId: 'cargo1', rolProfesional: 'Backend' });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { ConditionCheck: expect.objectContaining({
          TableName: 'usuarios-test',
          Key: { usuarioId: 'u1' },
          ConditionExpression: '#estado = :activo',
        }) },
        { Put: expect.objectContaining({ TableName: 'colaboradores-test' }) },
      ]),
    });
  });

  test('una desactivación concurrente de la cuenta cancela el alta del perfil', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'usuarios-test') return { Item: USUARIO };
      if (input.TableName === 'cargos-test') return { Item: { cargoId: 'cargo1', estado: 'ACTIVO' } };
      if (input.Key.colaboradorId === 'USUARIO#u1') return {};
      return {};
    });
    commandMocks.TransactWriteCommand.mockRejectedValueOnce(Object.assign(
      new Error('Cuenta desactivada'), { name: 'TransactionCanceledException' },
    ));
    await expect(colaboradores.crear({
      usuarioId: 'u1', cargoId: 'cargo1', rolProfesional: 'Backend',
    })).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledTimes(1);
  });

  test('rechaza crear un segundo perfil cuando existe uno histórico sin reserva', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'usuarios-test') return { Item: USUARIO };
      if (input.TableName === 'cargos-test') return { Item: { cargoId: 'cargo1', estado: 'ACTIVO' } };
      if (input.Key.colaboradorId === 'USUARIO#u1') return {};
      return {};
    });
    commandMocks.ScanCommand.mockResolvedValueOnce({ Items: [PERFIL] });
    await expect(colaboradores.crear({
      usuarioId: 'u1', cargoId: 'cargo1', rolProfesional: 'Backend',
    })).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });
});

describe('W05: baja y reincorporación coherente de colaboradores', () => {
  test('rechaza la baja con dedicación reservada distinta de cero', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'colaboradores-test') return { Item: { ...PERFIL, dedicacionReservada: 25 } };
      return { Item: USUARIO };
    });
    await expect(colaboradores.darBaja('c1')).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
  });

  test('rechaza la baja cuando hay asignaciones activas', async () => {
    commandMocks.QueryCommand.mockResolvedValueOnce({ Items: [{ asignacionId: 'a1' }] });
    await expect(colaboradores.darBaja('c1')).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.UpdateCommand).not.toHaveBeenCalled();
  });

  test('baja con condición de dedicación para impedir carreras concurrentes', async () => {
    await colaboradores.darBaja('c1');
    expect(commandMocks.UpdateCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'colaboradores-test',
      ConditionExpression: expect.stringContaining('dedicacionReservada = :cero'),
    }));
  });

  test('reincorporar obliga a que la cuenta permanezca activa en la transacción', async () => {
    commandMocks.GetCommand.mockImplementation(async input => {
      if (input.TableName === 'colaboradores-test') {
        return { Item: { ...PERFIL, estado: 'INACTIVO', fechaBaja: '2026-11-01' } };
      }
      return { Item: USUARIO };
    });
    await colaboradores.actualizar('c1', { estado: 'ACTIVO' });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { ConditionCheck: expect.objectContaining({
          TableName: 'usuarios-test',
          ConditionExpression: '#estado = :activo',
        }) },
        { Update: expect.objectContaining({ TableName: 'colaboradores-test' }) },
      ]),
    });
  });
});
