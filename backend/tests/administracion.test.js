jest.mock('../src/repositories/auditoria.repository.js', () => ({ listar: jest.fn() }));
jest.mock('../src/repositories/administracion.repository.js', () => ({
  obtener: jest.fn(),
  guardar: jest.fn(),
}));

const repositorio = require('../src/repositories/administracion.repository.js');
const auditoria = require('../src/repositories/auditoria.repository.js');
const { consultar, guardar, consultarAuditoria, validarConfiguracion, validarRolesPermisos } =
  require('../src/functions/administracion/handler.js');

const usuario = { usuarioId: 'admin-1', rol: 'ADMINISTRADOR' };
const parametros = [
  { id: 'limite-dedicacion', nombre: 'Límite de dedicación', descripcion: 'Límite', valor: '100', tipo: 'porcentaje' },
];
const catalogos = [
  { id: 'niveles-habilidad', nombre: 'Niveles', descripcion: 'Niveles oficiales', valores: ['Junior', 'Mid', 'Senior'] },
  { id: 'estados-proyecto', nombre: 'Estados', descripcion: 'Estados oficiales', valores: ['Borrador', 'Activo', 'Pausado', 'Completado', 'Cancelado'] },
];
const roles = [
  { id: 'EMPLEADO', nombre: 'Empleado', descripcion: 'Perfil profesional' },
  { id: 'RRHH', nombre: 'RRHH', descripcion: 'Gestión de personas' },
  { id: 'LIDER_PROYECTO', nombre: 'Líder de proyecto', descripcion: 'Gestión de proyectos' },
  { id: 'ADMINISTRADOR', nombre: 'Administrador', descripcion: 'Administración' },
];

describe('Configuración administrativa protegida', () => {
  beforeEach(() => jest.clearAllMocks());

  test('consulta la auditoría con filtros de fecha y cursor seguro', async () => {
    auditoria.listar.mockResolvedValue({ items: [{ auditoriaId: 'a1' }], lastKey: null });
    const respuesta = await consultarAuditoria({
      queryStringParameters: { desde: '2026-11-01', hasta: '2026-11-13', limite: '10' },
    });
    expect(respuesta.statusCode).toBe(200);
    expect(auditoria.listar).toHaveBeenCalledWith({
      desde: '2026-11-01', hasta: '2026-11-13', limite: 10, cursor: null,
    });
    expect(JSON.parse(respuesta.body).datos.items).toHaveLength(1);
  });

  test('rechaza fechas y cursores inválidos antes de consultar DynamoDB', async () => {
    for (const queryStringParameters of [
      { desde: '2026-02-30' }, { desde: '2026-11-13', hasta: '2026-11-01' },
      { cursor: '!' }, { limite: '999' },
    ]) {
      expect((await consultarAuditoria({ queryStringParameters })).statusCode).toBe(400);
    }
    expect(auditoria.listar).not.toHaveBeenCalled();
  });

  test('consulta sin valores retorna null para usar referencias locales', async () => {
    repositorio.obtener.mockResolvedValue(null);
    const respuesta = await consultar({}, 'configuracion');
    expect(respuesta.statusCode).toBe(200);
    expect(JSON.parse(respuesta.body).datos).toBeNull();
  });

  test('guarda parámetros adicionales sin alterar el límite real', async () => {
    repositorio.guardar.mockImplementation(async (area, contenido) => contenido);
    const datos = { parametros: [...parametros, {
      id: 'param_extra', nombre: 'Parámetro extra', descripcion: 'Valor complementario', valor: 'valor', tipo: 'texto',
    }], catalogos };
    const respuesta = await guardar({ body: JSON.stringify(datos), usuarioAutenticado: usuario }, 'configuracion');
    expect(respuesta.statusCode).toBe(200);
    expect(repositorio.guardar).toHaveBeenCalledWith('configuracion', expect.objectContaining({
      parametros: expect.arrayContaining([expect.objectContaining({ id: 'param_extra' })]),
    }), 'admin-1');
  });

  test('rechaza modificar o eliminar el límite del sistema', () => {
    expect(() => validarConfiguracion({ parametros: [{ ...parametros[0], valor: '75' }], catalogos }))
      .toThrow('100 %');
    expect(() => validarConfiguracion({ parametros: [], catalogos }))
      .toThrow('obligatorio');
  });

  test('rechaza alterar los niveles oficiales', () => {
    const nuevosCatalogos = catalogos.map(item => item.id === 'niveles-habilidad'
      ? { ...item, valores: ['Junior', 'Senior'] } : item);
    expect(() => validarConfiguracion({ parametros, catalogos: nuevosCatalogos }))
      .toThrow('fijos');
  });

  test('conserva los cuatro roles oficiales', () => {
    const datos = validarRolesPermisos({ roles, permisos: [] });
    expect(datos.roles).toHaveLength(4);
    expect(() => validarRolesPermisos({ roles: roles.slice(1), permisos: [] }))
      .toThrow('eliminar');
  });

  test('rechaza relaciones a roles desconocidos', () => {
    expect(() => validarRolesPermisos({
      roles,
      permisos: [{ id: 'perm_1', nombre: 'Ver', descripcion: 'Ver información', roles: ['INEXISTENTE'] }],
    })).toThrow('roles desconocidos');
  });

  test('falla con 400 por datos inválidos sin escribir', async () => {
    const respuesta = await guardar({
      body: JSON.stringify({ parametros: [], catalogos }), usuarioAutenticado: usuario,
    }, 'configuracion');
    expect(respuesta.statusCode).toBe(400);
    expect(repositorio.guardar).not.toHaveBeenCalled();
  });
});
