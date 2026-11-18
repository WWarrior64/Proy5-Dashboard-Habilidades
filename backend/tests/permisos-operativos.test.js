jest.mock('../src/config/dynamodb', () => require('./helpers/dynamodb.mock').crearMockDynamoDb());
jest.mock('../src/repositories/usuarios.repository', () => ({ obtenerPorCognitoSub: jest.fn() }));
jest.mock('../src/repositories/administracion.repository', () => ({ obtener: jest.fn() }));

const usuarios = require('../src/repositories/usuarios.repository');
const administracion = require('../src/repositories/administracion.repository');
const { crearDespachador } = require('../src/utils/lambda-dispatcher');
const { PERMISOS, ROLES, valoresIniciales, politicaVigente, permisoEfectivo, permisoDeRuta } =
  require('../src/config/permisos-operativos');
const { validarRolesPermisos, validarConfiguracion } =
  require('../src/functions/administracion/handler');

const operacion = jest.fn(async () => ({ statusCode: 200, body: '{}' }));
const handler = crearDespachador({
  'POST /api/v1/cargos': operacion,
  'POST /api/v1/colaboradores': operacion,
  'POST /api/v1/proyectos': operacion,
  'PATCH /api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}/estado': operacion,
  'GET /api/v1/cargos': operacion,
});

function solicitud(method, path) {
  return {
    httpMethod: method, path,
    body: JSON.stringify({ nombre: 'Cargo', descripcion: 'Cargo de ejemplo' }),
    requestContext: { authorizer: { claims: { sub: 'sub-1' } } },
  };
}

const previa = process.env.ENFORCE_PERMISSION_POLICY;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.ENFORCE_PERMISSION_POLICY = 'true';
  usuarios.obtenerPorCognitoSub.mockResolvedValue({
    usuarioId: 'usuario-rrhh', rol: 'RRHH', estado: 'ACTIVO',
  });
  administracion.obtener.mockResolvedValue(null);
});
afterAll(() => {
  if (previa === undefined) delete process.env.ENFORCE_PERMISSION_POLICY;
  else process.env.ENFORCE_PERMISSION_POLICY = previa;
});

describe('Política operativa por rol', () => {
  test('la ausencia de configuración conserva los permisos originales de RRHH', async () => {
    expect((await handler(solicitud('POST', '/api/v1/cargos'))).statusCode).toBe(200);
    expect(administracion.obtener).toHaveBeenCalledWith('roles-permisos');
  });

  test('deshabilitar la gestión de cargos impide la operación aunque el rol sea RRHH', async () => {
    const politica = valoresIniciales();
    politica.permisos.find(item => item.id === 'gestionar_cargos').roles = ['ADMINISTRADOR'];
    administracion.obtener.mockResolvedValue(politica);
    expect((await handler(solicitud('POST', '/api/v1/cargos'))).statusCode).toBe(403);
    expect(operacion).not.toHaveBeenCalled();
  });

  test('aceptar una postulación requiere gestionar postulaciones y asignaciones', async () => {
    const politica = valoresIniciales();
    politica.permisos.find(item => item.id === 'gestionar_asignaciones').roles = ['ADMINISTRADOR'];
    administracion.obtener.mockResolvedValue(politica);
    const event = solicitud('PATCH', '/api/v1/proyectos/p1/postulaciones/c1/estado');
    event.body = JSON.stringify({ estado: 'ACEPTADA' });
    expect((await handler(event)).statusCode).toBe(403);
    expect(operacion).not.toHaveBeenCalled();
    event.body = JSON.stringify({ estado: 'RECHAZADA' });
    expect((await handler(event)).statusCode).toBe(200);
  });

  test('ignora catálogos antiguos o incompletos y conserva las funciones originales de RRHH', async () => {
    const politicaIncompleta = { ...valoresIniciales(), permisos: [
      { id: 'gestionar_colaboradores', roles: ['ADMINISTRADOR'] },
      { id: 'gestionar_postulaciones', roles: ['EMPLEADO'] },
    ] };
    expect(politicaVigente(politicaIncompleta).permisos).toHaveLength(PERMISOS.length);
    administracion.obtener.mockResolvedValue(politicaIncompleta);
    expect((await handler(solicitud('POST', '/api/v1/cargos'))).statusCode).toBe(200);
    expect((await handler(solicitud('POST', '/api/v1/colaboradores'))).statusCode).toBe(200);
  });

  test('la configuración restaurada vuelve a permitir la operación del rol autorizado', async () => {
    administracion.obtener.mockResolvedValue(valoresIniciales());
    expect((await handler(solicitud('POST', '/api/v1/cargos'))).statusCode).toBe(200);
  });

  test('la política jamás concede permisos más allá del rol original', async () => {
    const politica = valoresIniciales();
    politica.permisos.find(item => item.id === 'gestionar_colaboradores').roles.push('EMPLEADO');
    expect(permisoEfectivo(politica, 'EMPLEADO', 'gestionar_colaboradores')).toBe(false);
    usuarios.obtenerPorCognitoSub.mockResolvedValue({
      usuarioId: 'empleado-1', rol: 'EMPLEADO', estado: 'ACTIVO',
    });
    administracion.obtener.mockResolvedValue(politica);
    expect((await handler(solicitud('POST', '/api/v1/colaboradores'))).statusCode).toBe(403);
    expect(operacion).not.toHaveBeenCalled();
  });

  test('no consulta la política para lecturas', async () => {
    expect((await handler(solicitud('GET', '/api/v1/cargos'))).statusCode).toBe(200);
    expect(administracion.obtener).not.toHaveBeenCalled();
  });

  test('los roles y permisos guardables solo incluyen capacidades oficiales', () => {
    const valores = valoresIniciales();
    expect(validarRolesPermisos(valores).permisos).toHaveLength(PERMISOS.length);
    expect(validarRolesPermisos(valores).roles).toHaveLength(ROLES.length);
    const escalada = valoresIniciales();
    escalada.permisos.find(item => item.id === 'gestionar_colaboradores').roles.push('EMPLEADO');
    expect(() => validarRolesPermisos(escalada)).toThrow('superiores');
    const bloqueo = valoresIniciales();
    bloqueo.permisos.find(item => item.id === 'gestionar_usuarios').roles = [];
    expect(() => validarRolesPermisos(bloqueo)).toThrow('administrador');
    const inventado = valoresIniciales();
    inventado.roles.push({ id: 'SUPERVISOR', nombre: 'Supervisor', descripcion: 'Rol inventado' });
    expect(() => validarRolesPermisos(inventado)).toThrow('oficiales');
  });

  test('las rutas de escritura corresponden al permiso operativo correcto', () => {
    expect(permisoDeRuta('PUT', '/api/v1/usuarios/{usuarioId}')).toBe('gestionar_usuarios');
    expect(permisoDeRuta('POST', '/api/v1/usuarios/yo/acceso')).toBeNull();
    expect(permisoDeRuta('POST', '/api/v1/colaboradores/{colaboradorId}/habilidades')).toBe('gestionar_habilidades_propias');
    expect(permisoDeRuta('PATCH', '/api/v1/proyectos/{proyectoId}/postulaciones/{colaboradorId}/estado')).toBe('gestionar_postulaciones');
    expect(permisoDeRuta('POST', '/api/v1/colaboradores/{colaboradorId}/asignaciones')).toBe('gestionar_asignaciones');
    expect(permisoDeRuta('GET', '/api/v1/cargos')).toBeNull();
  });

  test('la configuración de paginación y actividad rechaza valores fuera de rango', () => {
    const parametros = [
      { id: 'nombre-organizacion', nombre: 'Nombre', descripcion: 'Marca', valor: 'Internal Marketplace', tipo: 'texto' },
      { id: 'limite-dedicacion', nombre: 'Límite', descripcion: 'Regla fija', valor: '100', tipo: 'porcentaje' },
      { id: 'dias-actividad-dashboard', nombre: 'Actividad', descripcion: 'Días', valor: '91', tipo: 'numero' },
      { id: 'registros-pagina-dashboard', nombre: 'Página', descripcion: 'Cantidad', valor: '5', tipo: 'numero' },
    ];
    const catalogos = [
      { id: 'niveles-habilidad', nombre: 'Niveles', descripcion: 'Niveles', valores: ['Junior','Mid','Senior'] },
      { id: 'estados-proyecto', nombre: 'Estados', descripcion: 'Estados', valores: ['Borrador','Activo','Pausado','Completado','Cancelado'] },
    ];
    expect(() => validarConfiguracion({ parametros, catalogos })).toThrow('entre 1 y 90');
    parametros[2].valor = '30';
    parametros[3].valor = '2';
    expect(() => validarConfiguracion({ parametros, catalogos })).toThrow('entre 3 y 15');
    parametros[3].valor = '10';
    expect(validarConfiguracion({ parametros, catalogos }).parametros[3].valor).toBe('10');
  });
});
