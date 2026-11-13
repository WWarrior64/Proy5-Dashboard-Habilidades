jest.mock('../src/config/dynamodb.js', () =>
  require('./helpers/dynamodb.mock.js').crearMockDynamoDb()
);
jest.mock('../src/config/environment.js', () => ({
  tableColaboradores: 'colaboradores-test',
  tableAsignaciones: 'asignaciones-test',
  tableProyectos: 'proyectos-test',
}));

const { commandMocks } = require('../src/config/dynamodb.js');
const { proteger } = require('../src/middleware/route-policy.js');

const empleado = { usuarioId: 'u1', rol: 'EMPLEADO' };
const lider = { usuarioId: 'lider-1', rol: 'LIDER_PROYECTO' };
const administrador = { usuarioId: 'admin-1', rol: 'ADMINISTRADOR' };

describe('Autorización del backend y privacidad entre colaboradores', () => {
  beforeEach(() => {
    Object.values(commandMocks).forEach(mock => mock.mockReset());
  });

  test('el Empleado no puede listar todos los colaboradores', async () => {
    await expect(proteger({ usuarioAutenticado: empleado }, 'GET /api/v1/colaboradores'))
      .rejects.toMatchObject({ codigo: 403 });
  });

  test('el Empleado no puede consultar las habilidades de otra persona', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { colaboradorId: 'c2', usuarioId: 'u2' } });
    await expect(proteger({
      usuarioAutenticado: empleado, pathParameters: { colaboradorId: 'c2' },
    }, 'GET /api/v1/colaboradores/{colaboradorId}/habilidades'))
      .rejects.toMatchObject({ codigo: 403 });
  });

  test('el Empleado puede consultar sus propias habilidades', async () => {
    commandMocks.GetCommand.mockResolvedValueOnce({ Item: { colaboradorId: 'c1', usuarioId: 'u1' } });
    await expect(proteger({
      usuarioAutenticado: empleado, pathParameters: { colaboradorId: 'c1' },
    }, 'GET /api/v1/colaboradores/{colaboradorId}/habilidades'))
      .resolves.toBeUndefined();
  });

  test('el Líder conserva acceso a habilidades de candidatos', async () => {
    await expect(proteger({
      usuarioAutenticado: lider, pathParameters: { colaboradorId: 'c2' },
    }, 'GET /api/v1/colaboradores/{colaboradorId}/habilidades'))
      .resolves.toBeUndefined();
  });

  test('empleados y líderes pueden consultar la ruta propia sin enviar un colaboradorId', async () => {
    await expect(proteger({ usuarioAutenticado: lider },
      'GET /api/v1/asignaciones/mias')).resolves.toBeUndefined();
    await expect(proteger({ usuarioAutenticado: empleado },
      'GET /api/v1/asignaciones/mias')).resolves.toBeUndefined();
    expect(commandMocks.GetCommand).not.toHaveBeenCalled();
  });

  test('el líder puede consultar sus asignaciones como colaborador en un proyecto ajeno', async () => {
    commandMocks.GetCommand.mockResolvedValue({ Item: { colaboradorId: 'c-lider', usuarioId: 'lider-1' } });
    await expect(proteger({
      usuarioAutenticado: lider, pathParameters: { colaboradorId: 'c-lider' },
    }, 'GET /api/v1/colaboradores/{colaboradorId}/asignaciones')).resolves.toBeUndefined();
  });

  test('el líder no puede consultar las asignaciones privadas de otro colaborador', async () => {
    commandMocks.GetCommand.mockResolvedValue({ Item: { colaboradorId: 'c-ajeno', usuarioId: 'usuario-otro' } });
    await expect(proteger({
      usuarioAutenticado: lider, pathParameters: { colaboradorId: 'c-ajeno' },
    }, 'GET /api/v1/colaboradores/{colaboradorId}/asignaciones')).rejects.toMatchObject({ codigo: 403 });
  });

  test('el líder puede consultar el detalle de su participación ajena pero no modificarla', async () => {
    commandMocks.GetCommand.mockImplementation(async params => {
      if (params.TableName === 'asignaciones-test') return { Item: {
        asignacionId: 'a1', proyectoId: 'p-ajeno', colaboradorId: 'c-lider',
      } };
      if (params.TableName === 'proyectos-test') return { Item: { proyectoId: 'p-ajeno', liderId: 'otro-lider' } };
      return { Item: { colaboradorId: 'c-lider', usuarioId: 'lider-1' } };
    });
    await expect(proteger({ usuarioAutenticado: lider, pathParameters: { asignacionId: 'a1' } },
      'GET /api/v1/asignaciones/{asignacionId}')).resolves.toBeUndefined();
    await expect(proteger({ usuarioAutenticado: lider, pathParameters: { asignacionId: 'a1' } },
      'PUT /api/v1/asignaciones/{asignacionId}')).rejects.toMatchObject({ codigo: 403 });
  });

  test('la configuración administrativa exige el rol Administrador', async () => {
    await expect(proteger({ usuarioAutenticado: empleado }, 'GET /api/v1/administracion/configuracion'))
      .rejects.toMatchObject({ codigo: 403 });
    await expect(proteger({ usuarioAutenticado: administrador }, 'PUT /api/v1/administracion/configuracion'))
      .resolves.toBeUndefined();
  });
});
