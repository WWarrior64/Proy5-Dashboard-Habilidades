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
  { id: 'nombre-organizacion', nombre: 'Nombre de la organización', descripcion: 'Marca pública', valor: 'Internal Marketplace', tipo: 'texto' },
  { id: 'limite-dedicacion', nombre: 'Límite de dedicación', descripcion: 'Límite', valor: '100', tipo: 'porcentaje' },
  { id: 'dias-actividad-dashboard', nombre: 'Días de actividad', descripcion: 'Ventana', valor: '30', tipo: 'numero' },
  { id: 'registros-pagina-dashboard', nombre: 'Registros por página', descripcion: 'Página', valor: '5', tipo: 'numero' },
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

  test('consulta sin valores devuelve la configuración oficial predeterminada', async () => {
    repositorio.obtener.mockResolvedValue(null);
    const respuesta = await consultar({}, 'configuracion');
    expect(respuesta.statusCode).toBe(200);
    const datos = JSON.parse(respuesta.body).datos;
    expect(datos.parametros).toHaveLength(4);
    expect(datos.catalogos).toHaveLength(2);
    expect(datos.parametros.find(item => item.id === 'limite-dedicacion').valor).toBe('100');
  });

  test('guarda un parámetro utilizado realmente por el dashboard', async () => {
    repositorio.guardar.mockImplementation(async (area, contenido) => contenido);
    const datos = { parametros: parametros.map(item => item.id === 'dias-actividad-dashboard'
      ? { ...item, valor: '45' } : item), catalogos };
    const respuesta = await guardar({ body: JSON.stringify(datos), usuarioAutenticado: usuario }, 'configuracion');
    expect(respuesta.statusCode).toBe(200);
    expect(repositorio.guardar).toHaveBeenCalledWith('configuracion', expect.objectContaining({
      parametros: expect.arrayContaining([expect.objectContaining({ id: 'dias-actividad-dashboard', valor: '45' })]),
    }), 'admin-1');
  });

  test('rechaza parámetros y catálogos sin aplicación operativa', () => {
    const extra = { id: 'extra', nombre: 'Extra', descripcion: 'Sin consumidor', valor: 'x', tipo: 'texto' };
    expect(() => validarConfiguracion({ parametros: [...parametros, extra], catalogos }))
      .toThrow('sin funcionalidad');
    const catalogoExtra = { id: 'catalogo-extra', nombre: 'Extra', descripcion: 'Sin uso', valores: ['Uno'] };
    expect(() => validarConfiguracion({ parametros, catalogos: [...catalogos, catalogoExtra] }))
      .toThrow('sin funcionalidad');
  });

  test('rechaza modificar o eliminar el límite del sistema', () => {
    expect(() => validarConfiguracion({ parametros: [{ ...parametros[1], valor: '75' }], catalogos }))
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
