jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);
jest.mock('../src/config/environment.js', () => ({
  tableProyectoHabilidad: 'requisitos-test',
  tableColaboradorHabilidad: 'competencias-test',
  tableProyectos: 'proyectos-test',
  tableColaboradores: 'colaboradores-test',
  tableAsignaciones: 'asignaciones-test',
}));

const { commandMocks } = require('../src/config/dynamodb.js');
const dedicacion = require('../src/services/dedicacion.service.js');

beforeEach(() => {
  Object.values(commandMocks).forEach(mock => mock.mockReset());
  commandMocks.GetCommand.mockImplementation(async params => ({ Item:
    params.TableName === 'proyectos-test'
      ? { proyectoId: 'p1', estado: 'ACTIVO', requisitosRevision: 3 }
      : { colaboradorId: 'c1', estado: 'ACTIVO', habilidadesRevision: 5 },
  }));
  commandMocks.QueryCommand.mockImplementation(async params => {
    if (params.TableName === 'requisitos-test') return { Items: [
      { habilidadId: 'react', nivelMinimo: 'MID', esObligatoria: true, peso: 3 },
      { habilidadId: 'sql', nivelMinimo: 'JUNIOR', esObligatoria: false, peso: 1 },
    ] };
    if (params.TableName === 'competencias-test') return { Items: [
      { habilidadId: 'react', nivel: 'SENIOR' },
    ] };
    return { Items: [] };
  });
});

describe('W06: elegibilidad verificable por el backend', () => {
  test('acepta al candidato con la habilidad obligatoria y devuelve la puntuación', async () => {
    const resultado = await dedicacion.verificarHabilidadesObligatorias('p1', 'c1');
    expect(resultado.elegible).toBe(true);
    expect(resultado.puntuacion).toBe(75);
    expect(resultado.requisitosRevision).toBe(3);
    expect(resultado.habilidadesRevision).toBe(5);
    const reserva = dedicacion.reserva('c1', 25, resultado.habilidadesRevision);
    const actividad = dedicacion.actividadProyecto('p1', 1, 'u1', resultado.requisitosRevision);
    expect(reserva.Update.ConditionExpression).toContain('#rev = :revEsperada');
    expect(reserva.Update.ExpressionAttributeValues[':revEsperada']).toBe(5);
    expect(actividad.Update.ConditionExpression).toContain('#rev = :revEsperada');
    expect(actividad.Update.ExpressionAttributeValues[':revEsperada']).toBe(3);
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'requisitos-test', ConsistentRead: true,
    }));
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
      TableName: 'competencias-test', ConsistentRead: true,
    }));
  });

  test('rechaza a quien carece del nivel mínimo obligatorio', async () => {
    commandMocks.QueryCommand.mockImplementation(async params => ({
      Items: params.TableName === 'requisitos-test'
        ? [{ habilidadId: 'react', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 1 }]
        : [{ habilidadId: 'react', nivel: 'JUNIOR' }],
    }));
    await expect(dedicacion.verificarHabilidadesObligatorias('p1', 'c1'))
      .rejects.toMatchObject({ codigo: 409, message: expect.stringContaining('react') });
  });

  test('no asume requisitos vacíos como permisos automáticos de asignación', async () => {
    commandMocks.QueryCommand.mockResolvedValue({ Items: [] });
    await expect(dedicacion.verificarHabilidadesObligatorias('p1', 'c1'))
      .rejects.toMatchObject({ codigo: 409 });
  });
});
