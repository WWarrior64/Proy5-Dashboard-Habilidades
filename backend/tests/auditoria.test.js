jest.mock('../src/config/dynamodb', () => require('./helpers/dynamodb.mock').crearMockDynamoDb());
const { commandMocks } = require('../src/config/dynamodb');
const auditoria = require('../src/repositories/auditoria.repository');

beforeEach(() => {
  Object.values(commandMocks).forEach(mock => mock.mockReset());
});

describe('Auditoría persistente', () => {
  const actor = { usuarioId: 'usr-1', nombre: 'Ana García', rol: 'RRHH', estado: 'ACTIVO' };

  test('registra una creación con actor autenticado y sin guardar contraseñas del body', async () => {
    commandMocks.PutCommand.mockResolvedValue({});
    const evento = await auditoria.registrarDesdeSolicitud({
      usuarioAutenticado: actor,
      body: JSON.stringify({ nombre: 'Nuevo cargo', password: 'NO_REGISTRAR', token: 'NO_REGISTRAR' }),
      pathParameters: {},
    }, 'POST /api/v1/cargos', {
      statusCode: 201,
      body: JSON.stringify({ datos: { cargoId: 'cargo-1' } }),
    });
    expect(evento).toMatchObject({
      usuario: 'Ana García', usuarioId: 'usr-1', entidad: 'Cargos',
      accion: 'registró un cargo', tipo: 'CREACION', recursoId: 'cargo-1',
    });
    expect(commandMocks.PutCommand).toHaveBeenCalledWith(expect.objectContaining({
      ConditionExpression: 'attribute_not_exists(auditoriaId)',
      Item: expect.objectContaining({ tipoRegistro: 'EVENTO', fecha: expect.any(String) }),
    }));
    expect(JSON.stringify(commandMocks.PutCommand.mock.calls[0][0].Item)).not.toContain('NO_REGISTRAR');
  });

  test('clasifica operaciones anidadas y cambios de estado correctamente', () => {
    const cambio = auditoria.construirEvento({
      usuarioAutenticado: actor, pathParameters: { proyectoId: 'p1', colaboradorId: 'c1' },
      body: '{"estado":"ACEPTADA"}',
    }, 'PATCH /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}/estado', {
      statusCode: 200, body: '{}',
    });
    expect(cambio).toMatchObject({
      entidad: 'Postulaciones', tipo: 'CAMBIO_ESTADO', usuarioId: 'usr-1',
    });
  });

  test('incluye los inicios de sesión del usuario autenticado sin confiar en el body', () => {
    const evento = auditoria.construirEvento({
      usuarioAutenticado: actor,
      body: '{"usuarioId":"admin","fecha":"2050-12-01"}',
    }, 'POST /api/v1/usuarios/yo/acceso', { body: '{}' });
    expect(evento).toMatchObject({
      usuarioId: 'usr-1', recursoId: 'usr-1', tipo: 'INICIO_SESION', accion: 'inició sesión',
    });
    expect(evento.detalle).not.toContain('2050');
  });

  test('consulta la tabla por fecha descendente con paginación real', async () => {
    commandMocks.QueryCommand.mockResolvedValue({
      Items: [{ auditoriaId: 'a1' }],
      LastEvaluatedKey: { auditoriaId: 'a1', tipoRegistro: 'EVENTO', fechaId: '2026-11-13T10:00:00.000Z#a1' },
    });
    const resultado = await auditoria.listar({
      desde: '2026-11-01', hasta: '2026-11-13', limite: 20,
    });
    expect(resultado.items).toHaveLength(1);
    expect(resultado.lastKey.auditoriaId).toBe('a1');
    expect(commandMocks.QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
      IndexName: 'GSI1', ScanIndexForward: false, Limit: 20,
      KeyConditionExpression: expect.stringContaining('BETWEEN'),
      ExpressionAttributeValues: {
        ':tipo': 'EVENTO',
        ':desde': '2026-11-01T06:00:00.000Z#',
        ':hasta': '2026-11-14T05:59:59.999Z#~',
      },
    }));
  });
});
