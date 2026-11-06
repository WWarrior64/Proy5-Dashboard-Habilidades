jest.mock('../src/config/dynamodb', () => require('./helpers/dynamodb.mock').crearMockDynamoDb());
jest.mock('../src/repositories/usuarios.repository', () => ({ obtenerPorCognitoSub: jest.fn() }));
const usuarios = require('../src/repositories/usuarios.repository');
const { commandMocks } = require('../src/config/dynamodb');
const { crearDespachador } = require('../src/utils/lambda-dispatcher');
const fn = jest.fn(async (event) => ({ statusCode: 200, body: event.body || '{}', params: event.pathParameters }));
const handler = crearDespachador({
  'GET /api/v1/health': fn,
  'GET /api/v1/usuarios/yo': fn,
  'GET /api/v1/usuarios/{usuarioId}': fn,
  'PUT /api/v1/usuarios/{usuarioId}': fn,
  'PATCH /api/v1/usuarios/{usuarioId}/rol': fn,
  'POST /api/v1/proyectos': fn,
  'PUT /api/v1/proyectos/{proyectoId}': fn,
  'POST /api/v1/postulaciones': fn,
  'PATCH /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}/retirar': fn,
});
function event(method, path, body) {
  return { httpMethod: method, path, body: body && JSON.stringify(body), requestContext: { authorizer: { claims: { sub: 'sub' } } } };
}
beforeEach(() => {
  fn.mockClear();
  usuarios.obtenerPorCognitoSub.mockReset().mockResolvedValue({ usuarioId: 'u1', rol: 'EMPLEADO', estado: 'ACTIVO' });
  Object.values(commandMocks).forEach((mock) => mock.mockReset());
});
test('health público y recursos privados sin claims retornan 401', async () => {
  expect((await handler({ httpMethod: 'GET', path: '/api/v1/health' })).statusCode).toBe(200);
  expect((await handler({ httpMethod: 'GET', path: '/api/v1/usuarios/yo' })).statusCode).toBe(401);
  expect(usuarios.obtenerPorCognitoSub).not.toHaveBeenCalled();
});
test('usuario inactivo recibe 403', async () => {
  usuarios.obtenerPorCognitoSub.mockResolvedValue({ estado: 'INACTIVO' });
  expect((await handler(event('GET', '/api/v1/usuarios/yo'))).statusCode).toBe(403);
});
test('ruta estática yo tiene prioridad y JWT HTTP API admite jwt.claims', async () => {
  const input = event('GET', '/api/v1/usuarios/yo');
  input.requestContext.authorizer = { jwt: { claims: { sub: 'sub' } } };
  const result = await handler(input);
  expect(result.statusCode).toBe(200);
  expect(result.params).not.toHaveProperty('usuarioId');
});
test('resuelve plantillas genéricas de API Gateway usando path', async () => {
  const input = event('GET', '/api/v1/usuarios/u1');
  input.resource = '/api/v1/usuarios/{usuarioId}';
  expect((await handler(input)).params.usuarioId).toBe('u1');
});
test.each(['rol', 'estado', 'cognitoSub'])('perfil normal no permite modificar %s', async (field) => {
  expect((await handler(event('PUT', '/api/v1/usuarios/u1', { [field]: 'ADMINISTRADOR' }))).statusCode).toBe(403);
  expect(fn).not.toHaveBeenCalled();
});
test('empleado no puede leer otro usuario ni cambiar roles', async () => {
  expect((await handler(event('GET', '/api/v1/usuarios/u2'))).statusCode).toBe(403);
  expect((await handler(event('PATCH', '/api/v1/usuarios/u1/rol', { rol: 'ADMINISTRADOR' }))).statusCode).toBe(403);
});
test('administrador cambia rol y auditoría proviene de la identidad', async () => {
  usuarios.obtenerPorCognitoSub.mockResolvedValue({ usuarioId: 'admin', rol: 'ADMINISTRADOR', estado: 'ACTIVO' });
  const result = await handler(event('PATCH', '/api/v1/usuarios/u1/rol', { rol: 'RRHH', creadoPor: 'atacante' }));
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body).creadoPor).toBe('admin');
});
test('líder solo modifica su proyecto y no cambia su propietario', async () => {
  usuarios.obtenerPorCognitoSub.mockResolvedValue({ usuarioId: 'u1', rol: 'LIDER_PROYECTO', estado: 'ACTIVO' });
  commandMocks.GetCommand.mockResolvedValue({ Item: { liderId: 'u2' } });
  expect((await handler(event('PUT', '/api/v1/proyectos/p1', { nombre: 'X' }))).statusCode).toBe(403);
  commandMocks.GetCommand.mockResolvedValue({ Item: { liderId: 'u1' } });
  expect((await handler(event('PUT', '/api/v1/proyectos/p1', { liderId: 'u2' }))).statusCode).toBe(403);
  expect((await handler(event('PUT', '/api/v1/proyectos/p1', { nombre: 'X' }))).statusCode).toBe(200);
});
test('postulación y retirada requieren propiedad de colaborador', async () => {
  commandMocks.GetCommand.mockResolvedValue({ Item: { usuarioId: 'u2' } });
  expect((await handler(event('POST', '/api/v1/postulaciones', { proyectoId: 'p1', colaboradorId: 'col2' }))).statusCode).toBe(403);
  expect((await handler(event('PATCH', '/api/v1/proyectos/p1/postulaciones/col2/retirar', {}))).statusCode).toBe(403);
  commandMocks.GetCommand.mockResolvedValue({ Item: { usuarioId: 'u1' } });
  const result = await handler(event('PATCH', '/api/v1/proyectos/p1/postulaciones/col1/retirar', { revisadoPor: 'otro' }));
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body).revisadoPor).toBe('u1');
});
test('JSON inválido retorna 400, no ejecuta handler', async () => {
  const input = event('PUT', '/api/v1/usuarios/u1');
  input.body = '{';
  expect((await handler(input)).statusCode).toBe(400);
  expect(fn).not.toHaveBeenCalled();
});