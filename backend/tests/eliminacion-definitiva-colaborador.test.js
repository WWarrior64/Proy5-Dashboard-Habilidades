jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);
jest.mock('../src/config/environment.js', () => ({
  tableColaboradores: 'colaboradores-test',
  tableColaboradorHabilidad: 'colaborador-habilidad-test',
  tableAsignaciones: 'asignaciones-test',
  tablePostulaciones: 'postulaciones-test',
  tableUsuarios: 'usuarios-test',
  tableCargos: 'cargos-test',
}));

const { commandMocks } = require('../src/config/dynamodb.js');
const repo = require('../src/repositories/colaboradores.repository.js');

const PERFIL = {
  colaboradorId: 'c1', usuarioId: 'u1', estado: 'INACTIVO',
  dedicacionReservada: 0, habilidadesRevision: 2,
};

beforeEach(() => {
  Object.values(commandMocks).forEach(mock => mock.mockReset());
  commandMocks.GetCommand.mockImplementation(async entrada => {
    if (entrada.Key.colaboradorId === 'c1') return { Item: { ...PERFIL } };
    if (entrada.Key.colaboradorId === 'USUARIO#u1') {
      return { Item: { propietarioColaboradorId: 'c1' } };
    }
    return { Item: null };
  });
  commandMocks.ScanCommand.mockResolvedValue({ Items: [] });
  commandMocks.QueryCommand.mockResolvedValue({
    Items: [{ colaboradorId: 'c1', habilidadId: 'sql' }, { colaboradorId: 'c1', habilidadId: 'javascript' }],
  });
  commandMocks.TransactWriteCommand.mockResolvedValue({});
});

describe('Eliminación definitiva de perfiles dados de baja', () => {
  test('elimina atómicamente el perfil, sus habilidades y la reserva del usuario', async () => {
    const resultado = await repo.eliminarDefinitivamente('c1');
    expect(resultado).toEqual({ colaboradorId: 'c1', eliminado: true });
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledTimes(1);
    expect(commandMocks.TransactWriteCommand).toHaveBeenCalledWith({
      TransactItems: expect.arrayContaining([
        { Delete: expect.objectContaining({
          TableName: 'colaboradores-test', Key: { colaboradorId: 'c1' },
          ConditionExpression: expect.stringContaining('#estado = :inactivo'),
        }) },
        { Delete: expect.objectContaining({
          TableName: 'colaboradores-test', Key: { colaboradorId: 'USUARIO#u1' },
          ConditionExpression: '#propietario = :colaborador',
        }) },
        { Delete: expect.objectContaining({
          TableName: 'colaborador-habilidad-test', Key: { colaboradorId: 'c1', habilidadId: 'sql' },
        }) },
        { Delete: expect.objectContaining({
          TableName: 'colaborador-habilidad-test', Key: { colaboradorId: 'c1', habilidadId: 'javascript' },
        }) },
      ]),
    });
    expect(commandMocks.ScanCommand).toHaveBeenCalledTimes(2);
  });

  test('bloquea el borrado de un perfil activo', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { ...PERFIL, estado: 'ACTIVO' } });
    await expect(repo.eliminarDefinitivamente('c1')).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('bloquea el borrado si existe historial de asignaciones', async () => {
    commandMocks.ScanCommand.mockResolvedValueOnce({ Items: [{ colaboradorId: 'c1' }] });
    await expect(repo.eliminarDefinitivamente('c1')).rejects.toThrow(/asignaciones/);
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('bloquea el borrado si existen postulaciones aunque no haya asignaciones', async () => {
    commandMocks.ScanCommand
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [{ colaboradorId: 'c1' }] });
    await expect(repo.eliminarDefinitivamente('c1')).rejects.toThrow(/postulaciones/);
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('revisa todas las páginas al detectar dependencias históricas', async () => {
    commandMocks.ScanCommand
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { asignacionId: 'a1' } })
      .mockResolvedValueOnce({ Items: [{ colaboradorId: 'c1' }] });
    await expect(repo.eliminarDefinitivamente('c1')).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.ScanCommand).toHaveBeenCalledTimes(2);
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('no elimina la reserva si corresponde a otro perfil', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { ...PERFIL } })
      .mockResolvedValueOnce({ Item: { propietarioColaboradorId: 'c2' } });
    await expect(repo.eliminarDefinitivamente('c1')).rejects.toMatchObject({ codigo: 409 });
    expect(commandMocks.TransactWriteCommand).not.toHaveBeenCalled();
  });

  test('convierte un conflicto transaccional en 409, sin reportar una eliminación exitosa', async () => {
    commandMocks.TransactWriteCommand.mockRejectedValueOnce(Object.assign(
      new Error('Cambio concurrente'), { name: 'TransactionCanceledException' }
    ));
    await expect(repo.eliminarDefinitivamente('c1')).rejects.toMatchObject({ codigo: 409 });
  });
});
