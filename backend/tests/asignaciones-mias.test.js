jest.mock('../src/repositories/colaboradores.repository.js', () => ({
  obtenerPorUsuarioId: jest.fn(),
}));
jest.mock('../src/repositories/asignaciones.repository.js', () => ({
  listarAsignacionesColaborador: jest.fn(),
}));
const colaboradores = require('../src/repositories/colaboradores.repository.js');
const asignaciones = require('../src/repositories/asignaciones.repository.js');
const { listarMisAsignaciones } = require('../src/functions/asignaciones/handler.js');

const evento = { usuarioAutenticado: { usuarioId: 'lider-1', rol: 'LIDER_PROYECTO', estado: 'ACTIVO' } };

beforeEach(() => jest.clearAllMocks());

describe('Consulta autenticada de mis asignaciones', () => {
  test('permite a un líder consultar las participaciones en proyectos ajenos por su propia identidad', async () => {
    colaboradores.obtenerPorUsuarioId.mockResolvedValue({
      usuarioId: 'lider-1', colaboradorId: 'col-lider',
    });
    asignaciones.listarAsignacionesColaborador.mockResolvedValue([
      { asignacionId: 'a1', proyectoId: 'proyecto-ajeno', colaboradorId: 'col-lider', estado: 'ACTIVA' },
    ]);
    const respuesta = await listarMisAsignaciones({
      ...evento, pathParameters: { colaboradorId: 'col-otra-persona' },
    });
    expect(respuesta.statusCode).toBe(200);
    expect(colaboradores.obtenerPorUsuarioId).toHaveBeenCalledWith('lider-1');
    expect(asignaciones.listarAsignacionesColaborador).toHaveBeenCalledWith('col-lider');
    expect(JSON.parse(respuesta.body).datos).toEqual({
      tienePerfil: true,
      items: [{ asignacionId: 'a1', proyectoId: 'proyecto-ajeno', colaboradorId: 'col-lider', estado: 'ACTIVA' }],
    });
  });

  test('responde sin perfil, sin consultar registros de otros colaboradores', async () => {
    colaboradores.obtenerPorUsuarioId.mockResolvedValue(null);
    const respuesta = await listarMisAsignaciones(evento);
    expect(respuesta.statusCode).toBe(200);
    expect(JSON.parse(respuesta.body).datos).toEqual({ items: [], tienePerfil: false });
    expect(asignaciones.listarAsignacionesColaborador).not.toHaveBeenCalled();
  });

  test('requiere una identidad autenticada y no consulta asignaciones si falta', async () => {
    const respuesta = await listarMisAsignaciones({});
    expect(respuesta.statusCode).toBe(401);
    expect(colaboradores.obtenerPorUsuarioId).not.toHaveBeenCalled();
    expect(asignaciones.listarAsignacionesColaborador).not.toHaveBeenCalled();
  });
});
