const colaboradoresHandler = require('../src/functions/colaboradores/handler');
const colaboradoresRepository = require('../src/repositories/colaboradores.repository');

jest.mock('../src/repositories/colaboradores.repository');
jest.mock('../src/repositories/usuarios.repository');
const usuariosRepository = require('../src/repositories/usuarios.repository');

describe('Módulo de Colaboradores - Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('crearColaborador', () => {
    test('devuelve 400 ante JSON malformado sin invocar el repositorio', async () => {
      const result = await colaboradoresHandler.crearColaborador({ body: '{malformado' }, {});
      expect(result.statusCode).toBe(400);
      expect(colaboradoresRepository.crear).not.toHaveBeenCalled();
    });

    test('rechaza valores de estado fuera del contrato Joi', async () => {
      const respuesta = await colaboradoresHandler.crearColaborador({ body: JSON.stringify({
        usuarioId: 'u1', cargoId: 'c1', rolProfesional: 'Dev', estado: 'DESCONOCIDO',
      }) }, {});
      expect(respuesta.statusCode).toBe(400);
      expect(colaboradoresRepository.crear).not.toHaveBeenCalled();
    });

    test('debe crear un colaborador válido', async () => {
      const colaboradorMock = {
        colaboradorId: 'col_1',
        usuarioId: 'usr_1',
        cargoId: 'cargo_1',
        rolProfesional: 'Desarrollador',
        estado: 'ACTIVO',
      };
      colaboradoresRepository.crear.mockResolvedValue(colaboradorMock);
      const event = { body: JSON.stringify(colaboradorMock) };
      const result = await colaboradoresHandler.crearColaborador(event, {});
      expect(result.statusCode).toBe(201);
      expect(colaboradoresRepository.crear).toHaveBeenCalledWith(colaboradorMock);
    });

    test('rechaza una matriz JSON aunque su sintaxis sea válida', async () => {
      const result = await colaboradoresHandler.crearColaborador({ body: '[]' }, {});
      expect(result.statusCode).toBe(400);
      expect(colaboradoresRepository.crear).not.toHaveBeenCalled();
    });

    test('debe retornar 400 cuando faltan campos requeridos', async () => {
      const event = { body: JSON.stringify({ colaboradorId: 'col_1' }) };
      const result = await colaboradoresHandler.crearColaborador(event, {});
      expect(result.statusCode).toBe(400);
    });

    test('debe retornar 409 cuando el usuario ya tiene un perfil de colaborador', async () => {
      const error = new Error('El usuario ya tiene un perfil de colaborador asociado');
      error.codigo = 409;
      error.codigoError = 'CONFLICT';
      colaboradoresRepository.crear.mockRejectedValue(error);
      const event = {
        body: JSON.stringify({
          colaboradorId: 'col_2', usuarioId: 'usr_1', cargoId: 'cargo_1', rolProfesional: 'Dev',
        }),
      };
      const result = await colaboradoresHandler.crearColaborador(event, {});
      expect(result.statusCode).toBe(409);
    });

    test('debe retornar 400 cuando el cargo está inactivo', async () => {
      const error = new Error('No se puede asignar un colaborador a un cargo inactivo');
      error.codigo = 400;
      error.codigoError = 'VALIDATION_ERROR';
      colaboradoresRepository.crear.mockRejectedValue(error);
      const event = {
        body: JSON.stringify({
          colaboradorId: 'col_1', usuarioId: 'usr_1', cargoId: 'cargo_inactivo', rolProfesional: 'Dev',
        }),
      };
      const result = await colaboradoresHandler.crearColaborador(event, {});
      expect(result.statusCode).toBe(400);
    });
  });

  describe('listarColaboradores', () => {
    test('el Líder recibe el nombre real vinculado al usuario sin exponer su correo', async () => {
      colaboradoresRepository.listar.mockResolvedValue({
        items: [{ colaboradorId: 'col_1', usuarioId: 'u1', nombre: 'Backend', rolProfesional: 'Backend' }],
        lastKey: null,
      });
      usuariosRepository.obtenerPorId.mockResolvedValue({ usuarioId: 'u1', nombre: 'Ana Flores', email: 'privado@empresa.test' });
      const respuesta = await colaboradoresHandler.listarColaboradores({
        queryStringParameters: {}, usuarioAutenticado: { usuarioId: 'lider-1', rol: 'LIDER_PROYECTO' },
      }, {});
      expect(respuesta.statusCode).toBe(200);
      const item = JSON.parse(respuesta.body).datos.items[0];
      expect(item.nombre).toBe('Ana Flores');
      expect(item.nombreUsuario).toBe('Ana Flores');
      expect(item.email).toBeUndefined();
    });

    test('distingue dos colaboradores con el mismo cargo usando los nombres de sus cuentas', async () => {
      colaboradoresRepository.listar.mockResolvedValue({
        items: [
          { colaboradorId: 'colab_backend_001', usuarioId: 'u1',
            nombre: 'Desarrollador Backend', rolProfesional: 'Desarrollador Backend' },
          { colaboradorId: 'colab_backend_002', usuarioId: 'u2',
            nombre: 'Desarrollador Backend', rolProfesional: 'Desarrollador Backend' },
        ],
        lastKey: null,
      });
      usuariosRepository.obtenerPorId.mockImplementation(async id => ({
        usuarioId: id, nombre: id === 'u1' ? 'Alejandro Gonzalez' : 'Carlos Méndez',
      }));
      const respuesta = await colaboradoresHandler.listarColaboradores({
        queryStringParameters: {},
        usuarioAutenticado: { usuarioId: 'lider-1', rol: 'LIDER_PROYECTO' },
      }, {});
      expect(respuesta.statusCode).toBe(200);
      const items = JSON.parse(respuesta.body).datos.items;
      expect(items.map(item => item.nombre)).toEqual(['Alejandro Gonzalez', 'Carlos Méndez']);
      expect(items.map(item => item.nombreUsuario)).toEqual(['Alejandro Gonzalez', 'Carlos Méndez']);
    });

    test('envía el cursor opaco al repositorio y entrega el cursor de la página siguiente', async () => {
      const clave = { colaboradorId: 'col-25' };
      const cursor = Buffer.from(JSON.stringify(clave)).toString('base64url');
      colaboradoresRepository.listar.mockResolvedValue({ items: [{ colaboradorId: 'col-26' }], lastKey: { colaboradorId: 'col-26' } });
      const respuesta = await colaboradoresHandler.listarColaboradores({ queryStringParameters: { cursor } }, {});
      expect(respuesta.statusCode).toBe(200);
      expect(colaboradoresRepository.listar).toHaveBeenCalledWith({ lastKey: clave });
      expect(JSON.parse(respuesta.body).datos.nextCursor).toBe(Buffer.from(JSON.stringify({ colaboradorId: 'col-26' })).toString('base64url'));
    });

    test('rechaza cursores inválidos antes de acceder a DynamoDB', async () => {
      const respuesta = await colaboradoresHandler.listarColaboradores({ queryStringParameters: { cursor: '!!!' } }, {});
      expect(respuesta.statusCode).toBe(400);
      expect(colaboradoresRepository.listar).not.toHaveBeenCalled();
    });

    test('debe listar colaboradores con filtros', async () => {
      colaboradoresRepository.listar.mockResolvedValue({ items: [{ colaboradorId: 'col_1' }], lastKey: null });
      const event = { queryStringParameters: { estado: 'ACTIVO', cargoId: 'cargo_1' } };
      const result = await colaboradoresHandler.listarColaboradores(event, {});
      expect(result.statusCode).toBe(200);
      expect(colaboradoresRepository.listar).toHaveBeenCalledWith({ estado: 'ACTIVO', cargoId: 'cargo_1' });
    });
  });

  describe('obtenerColaborador', () => {
    test('el Líder reconoce un perfil histórico por el nombre de su usuario', async () => {
      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'colab_backend_002', usuarioId: 'u2',
        nombre: 'Desarrollador Backend', rolProfesional: 'Desarrollador Backend',
      });
      usuariosRepository.obtenerPorId.mockResolvedValue({
        usuarioId: 'u2', nombre: 'Carlos Méndez', email: 'privado@empresa.test',
      });
      const respuesta = await colaboradoresHandler.obtenerColaborador({
        pathParameters: { colaboradorId: 'colab_backend_002' },
        usuarioAutenticado: { usuarioId: 'lider-1', rol: 'LIDER_PROYECTO' },
      }, {});
      expect(respuesta.statusCode).toBe(200);
      const perfil = JSON.parse(respuesta.body).datos;
      expect(perfil.nombre).toBe('Carlos Méndez');
      expect(perfil.nombreUsuario).toBe('Carlos Méndez');
      expect(perfil.email).toBeUndefined();
    });

    test('sin usuario asociado no confunde la profesión con el nombre', async () => {
      colaboradoresRepository.obtenerPorId.mockResolvedValue({
        colaboradorId: 'colab_backend_001', usuarioId: 'u1',
        nombre: 'Desarrollador Backend', rolProfesional: 'Desarrollador Backend',
      });
      usuariosRepository.obtenerPorId.mockResolvedValue(null);
      const respuesta = await colaboradoresHandler.obtenerColaborador({
        pathParameters: { colaboradorId: 'colab_backend_001' },
        usuarioAutenticado: { usuarioId: 'lider-1', rol: 'LIDER_PROYECTO' },
      }, {});
      expect(JSON.parse(respuesta.body).datos.nombre).toBe('Colaborador colab_backend_001');
    });

    test('debe retornar un colaborador por su ID', async () => {
      colaboradoresRepository.obtenerPorId.mockResolvedValue({ colaboradorId: 'col_1', usuarioId: 'usr_1' });
      const event = { pathParameters: { colaboradorId: 'col_1' } };
      const result = await colaboradoresHandler.obtenerColaborador(event, {});
      expect(result.statusCode).toBe(200);
      expect(colaboradoresRepository.obtenerPorId).toHaveBeenCalledWith('col_1');
    });

    test('debe retornar 404 cuando el colaborador no existe', async () => {
      colaboradoresRepository.obtenerPorId.mockResolvedValue(null);
      const event = { pathParameters: { colaboradorId: 'inexistente' } };
      const result = await colaboradoresHandler.obtenerColaborador(event, {});
      expect(result.statusCode).toBe(404);
    });
  });

  describe('actualizarColaborador', () => {
    test('debe actualizar la información profesional de un colaborador', async () => {
      colaboradoresRepository.actualizar.mockResolvedValue({ colaboradorId: 'col_1', cargoId: 'cargo_2' });
      const event = {
        pathParameters: { colaboradorId: 'col_1' },
        body: JSON.stringify({ cargoId: 'cargo_2' }),
      };
      const result = await colaboradoresHandler.actualizarColaborador(event, {});
      expect(result.statusCode).toBe(200);
      expect(colaboradoresRepository.actualizar).toHaveBeenCalledWith('col_1', { cargoId: 'cargo_2' });
    });
  });

  describe('reincorporación de colaboradores', () => {
    test('permite reactivar el mismo identificador por la ruta de actualización', async () => {
      colaboradoresRepository.actualizar.mockResolvedValue({
        colaboradorId: 'col_1', estado: 'ACTIVO', fechaBaja: null,
      });
      const respuesta = await colaboradoresHandler.actualizarColaborador({
        pathParameters: { colaboradorId: 'col_1' },
        body: JSON.stringify({ estado: 'ACTIVO' }),
      }, {});
      expect(respuesta.statusCode).toBe(200);
      expect(colaboradoresRepository.actualizar).toHaveBeenCalledWith('col_1', { estado: 'ACTIVO' });
      expect(colaboradoresRepository.crear).not.toHaveBeenCalled();
    });
  });

  describe('darBajaColaborador', () => {
    test('debe dar de baja un colaborador cambiando estado a INACTIVO', async () => {
      colaboradoresRepository.darBaja.mockResolvedValue({ colaboradorId: 'col_1', estado: 'INACTIVO' });
      const event = { pathParameters: { colaboradorId: 'col_1' } };
      const result = await colaboradoresHandler.darBajaColaborador(event, {});
      expect(result.statusCode).toBe(200);
      expect(colaboradoresRepository.darBaja).toHaveBeenCalledWith('col_1');
    });
  });
});