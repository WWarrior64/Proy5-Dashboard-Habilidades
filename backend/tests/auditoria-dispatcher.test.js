jest.mock('../src/repositories/usuarios.repository', () => ({
  obtenerPorCognitoSub: jest.fn(),
}));
jest.mock('../src/repositories/auditoria.repository', () => ({
  registrarDesdeSolicitud: jest.fn(),
}));
const usuarios = require('../src/repositories/usuarios.repository');
const auditoria = require('../src/repositories/auditoria.repository');
const { crearDespachador } = require('../src/utils/lambda-dispatcher');

const mutacion = jest.fn(async () => ({
  statusCode: 201, body: JSON.stringify({ success: true, datos: { cargoId: 'cargo-1' } }),
}));
const consulta = jest.fn(async () => ({ statusCode: 200, body: '{}' }));
const dispatcher = crearDespachador({
  'POST /api/v1/cargos': mutacion,
  'GET /api/v1/cargos': consulta,
  'GET /api/v1/administracion/auditoria': consulta,
});
const evento = (metodo, ruta) => ({
  httpMethod: metodo, path: ruta,
  requestContext: { authorizer: { claims: { sub: 'sub-admin' } } },
});
const valorOriginal = process.env.AUDIT_ENABLED;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AUDIT_ENABLED = 'true';
  usuarios.obtenerPorCognitoSub.mockResolvedValue({
    usuarioId: 'admin-1', nombre: 'Administradora', rol: 'ADMINISTRADOR', estado: 'ACTIVO',
  });
  auditoria.registrarDesdeSolicitud.mockResolvedValue({ auditoriaId: 'evento-1' });
});
afterAll(() => {
  if (valorOriginal === undefined) delete process.env.AUDIT_ENABLED;
  else process.env.AUDIT_ENABLED = valorOriginal;
});

test('registra solamente las operaciones confirmadas con el actor autenticado', async () => {
  expect((await dispatcher(evento('POST', '/api/v1/cargos'))).statusCode).toBe(201);
  expect(auditoria.registrarDesdeSolicitud).toHaveBeenCalledTimes(1);
  expect(auditoria.registrarDesdeSolicitud).toHaveBeenCalledWith(
    expect.objectContaining({
      usuarioAutenticado: expect.objectContaining({ usuarioId: 'admin-1', nombre: 'Administradora' }),
    }), 'POST /api/v1/cargos', expect.objectContaining({ statusCode: 201 }),
  );
});

test('no registra consultas ni mutaciones fallidas', async () => {
  await dispatcher(evento('GET', '/api/v1/cargos'));
  mutacion.mockResolvedValueOnce({ statusCode: 400, body: '{}' });
  await dispatcher(evento('POST', '/api/v1/cargos'));
  expect(auditoria.registrarDesdeSolicitud).not.toHaveBeenCalled();
});

test('el registro de auditoría solo puede ser leído por administradores', async () => {
  usuarios.obtenerPorCognitoSub.mockResolvedValueOnce({
    usuarioId: 'empleado-1', rol: 'EMPLEADO', estado: 'ACTIVO',
  });
  expect((await dispatcher(evento('GET', '/api/v1/administracion/auditoria'))).statusCode).toBe(403);
  expect((await dispatcher(evento('GET', '/api/v1/administracion/auditoria'))).statusCode).toBe(200);
});
