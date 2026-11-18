jest.mock('../src/repositories/auditoria.repository', () => ({ listar: jest.fn() }));
jest.mock('../src/repositories/administracion.repository', () => ({
  obtener: jest.fn(), guardar: jest.fn(),
}));

const repositorio = require('../src/repositories/administracion.repository');
const { handler, validarConfiguracion } = require('../src/functions/administracion/handler');

beforeEach(() => jest.clearAllMocks());

describe('Nombre público de la organización', () => {
  test('es público y expone solamente el nombre autorizado', async () => {
    repositorio.obtener.mockResolvedValue({
      parametros: [{ id: 'nombre-organizacion', valor: 'Marketplace de Talento' }],
      catalogos: [{ id: 'interno', valores: ['secreto'] }],
    });
    const respuesta = await handler({
      httpMethod: 'GET', path: '/api/v1/branding',
    });
    expect(respuesta.statusCode).toBe(200);
    const datos = JSON.parse(respuesta.body).datos;
    expect(datos).toEqual({ nombreOrganizacion: 'Marketplace de Talento' });
    expect(JSON.stringify(datos)).not.toContain('secreto');
    expect(repositorio.obtener).toHaveBeenCalledWith('configuracion');
  });

  test('un fallo del catálogo no expone errores internos al visitante', async () => {
    const registro = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      repositorio.obtener.mockRejectedValue(new Error('AccessDeniedException: detalle privado'));
      const respuesta = await handler({ httpMethod: 'GET', path: '/api/v1/branding' });
      expect(respuesta.statusCode).toBe(200);
      expect(JSON.parse(respuesta.body).datos.nombreOrganizacion).toBe('Internal Marketplace');
      expect(respuesta.body).not.toContain('AccessDeniedException');
    } finally { registro.mockRestore(); }
  });

  test('la configuración valida un nombre público no vacío y de longitud acotada', () => {
    const parametros = [
      { id: 'limite-dedicacion', nombre: 'Límite', descripcion: 'Regla', valor: '100', tipo: 'porcentaje' },
      { id: 'nombre-organizacion', nombre: 'Nombre', descripcion: 'Marca pública', valor: '', tipo: 'texto' },
      { id: 'dias-actividad-dashboard', nombre: 'Días de actividad', descripcion: 'Ventana del dashboard', valor: '30', tipo: 'numero' },
      { id: 'registros-pagina-dashboard', nombre: 'Registros por página', descripcion: 'Paginación del dashboard', valor: '5', tipo: 'numero' },
    ];
    const catalogos = [
      { id: 'niveles-habilidad', nombre: 'Niveles', descripcion: 'Niveles', valores: ['Junior','Mid','Senior'] },
      { id: 'estados-proyecto', nombre: 'Estados', descripcion: 'Estados', valores: ['Borrador','Activo','Pausado','Completado','Cancelado'] },
    ];
    expect(() => validarConfiguracion({ parametros, catalogos })).toThrow('nombre de la organización');
    parametros[1].valor = 'Marketplace de Talento';
    expect(validarConfiguracion({ parametros, catalogos }).parametros[1].esReferencia).toBe(false);
    parametros[1].valor = 'N'.repeat(71);
    expect(() => validarConfiguracion({ parametros, catalogos })).toThrow('nombre de la organización');
  });
});
