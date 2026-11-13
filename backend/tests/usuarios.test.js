const usuariosHandler = require('../src/functions/usuarios/handler');
const usuariosRepository = require('../src/repositories/usuarios.repository');
const { resolverIdentidad } = require('../src/services/cognito-admin.service');

jest.mock('../src/repositories/usuarios.repository');
jest.mock('../src/services/cognito-admin.service');

describe('Módulo de Usuarios - Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('obtenerUsuario', () => {
    test('debe retornar un usuario existente por su ID', async () => {
      const usuarioMock = {
        usuarioId: 'usr_1',
        cognitoSub: 'cognito_123',
        nombre: 'Juan Pérez',
        email: 'juan@test.com',
        rol: 'EMPLEADO',
        estado: 'ACTIVO',
      };
      usuariosRepository.obtenerPorId.mockResolvedValue(usuarioMock);

      const event = { pathParameters: { usuarioId: 'usr_1' } };
      const result = await usuariosHandler.obtenerUsuario(event, {});

      expect(result.statusCode).toBe(200);
      expect(usuariosRepository.obtenerPorId).toHaveBeenCalledWith('usr_1');
    });

    test('debe retornar 404 cuando el usuario no existe', async () => {
      usuariosRepository.obtenerPorId.mockResolvedValue(null);
      const event = { pathParameters: { usuarioId: 'inexistente' } };
      const result = await usuariosHandler.obtenerUsuario(event, {});
      expect(result.statusCode).toBe(404);
    });

    test('debe retornar 400 cuando falta usuarioId', async () => {
      const event = { pathParameters: {} };
      const result = await usuariosHandler.obtenerUsuario(event, {});
      expect(result.statusCode).toBe(400);
    });
  });

  describe('obtenerPerfil', () => {
    test('debe retornar el perfil del usuario autenticado por cognitoSub', async () => {
      const usuarioMock = { usuarioId: 'usr_1', cognitoSub: 'cognito_123', estado: 'ACTIVO' };
      usuariosRepository.obtenerPorCognitoSub.mockResolvedValue(usuarioMock);
      const event = {
        requestContext: { authorizer: { claims: { sub: 'cognito_123' } } },
      };
      const result = await usuariosHandler.obtenerPerfil(event, {});
      expect(result.statusCode).toBe(200);
      expect(usuariosRepository.obtenerPorCognitoSub).toHaveBeenCalledWith('cognito_123');
    });

    test('debe retornar 401 cuando no hay identidad de Cognito', async () => {
      const event = { requestContext: { authorizer: {} } };
      const result = await usuariosHandler.obtenerPerfil(event, {});
      expect(result.statusCode).toBe(401);
    });

    test('debe retornar 403 cuando el usuario está inactivo', async () => {
      usuariosRepository.obtenerPorCognitoSub.mockResolvedValue({ estado: 'INACTIVO' });
      const event = {
        requestContext: { authorizer: { claims: { sub: 'cognito_123' } } },
      };
      const result = await usuariosHandler.obtenerPerfil(event, {});
      expect(result.statusCode).toBe(403);
    });
  });

  describe('listarUsuarios', () => {
    test('debe listar usuarios con filtros', async () => {
      usuariosRepository.listar.mockResolvedValue({ items: [{ usuarioId: 'usr_1' }], lastKey: null });
      const event = { queryStringParameters: { rol: 'EMPLEADO', limit: '10' } };
      const result = await usuariosHandler.listarUsuarios(event, {});
      expect(result.statusCode).toBe(200);
      expect(usuariosRepository.listar).toHaveBeenCalledWith({ rol: 'EMPLEADO', limit: 10 });
    });
  });

  describe('crearUsuario', () => {
    const eventoAdmin = (body) => ({
      requestContext: { authorizer: { claims: { sub: 'sub_admin' } } },
      body: JSON.stringify(body),
    });

    beforeEach(() => {
      usuariosRepository.obtenerPorCognitoSub.mockResolvedValue({
        usuarioId: 'usr_admin',
        cognitoSub: 'sub_admin',
        rol: 'ADMINISTRADOR',
        estado: 'ACTIVO',
      });
      resolverIdentidad.mockResolvedValue({
        cognitoSub: 'sub_nuevo',
        creadoEnCognito: true,
      });
    });

    test('debe crear un usuario válido mediante su correo, sin recibir cognitoSub del cliente', async () => {
      usuariosRepository.crear.mockResolvedValue({
        usuarioId: 'usr_generado',
        cognitoSub: 'sub_nuevo',
        nombre: 'Juan',
        email: 'juan@test.com',
        rol: 'EMPLEADO',
        estado: 'ACTIVO',
      });

      const result = await usuariosHandler.crearUsuario(
        eventoAdmin({ nombre: 'Juan', email: 'juan@test.com', rol: 'EMPLEADO' }),
        {}
      );

      expect(result.statusCode).toBe(201);
      expect(usuariosRepository.obtenerPorCognitoSub).toHaveBeenCalledWith('sub_admin');
      expect(resolverIdentidad).toHaveBeenCalledWith({ email: 'juan@test.com', nombre: 'Juan' });
      expect(usuariosRepository.crear).toHaveBeenCalledWith(expect.objectContaining({
        cognitoSub: 'sub_nuevo',
        nombre: 'Juan',
        email: 'juan@test.com',
        rol: 'EMPLEADO',
        estado: 'ACTIVO',
      }));
    });

    test('debe retornar 400 cuando faltan campos requeridos', async () => {
      const result = await usuariosHandler.crearUsuario(eventoAdmin({ nombre: 'Juan' }), {});
      expect(result.statusCode).toBe(400);
      expect(resolverIdentidad).not.toHaveBeenCalled();
      expect(usuariosRepository.crear).not.toHaveBeenCalled();
    });

    test('debe retornar 409 cuando ya existe el usuario', async () => {
      const error = new Error('Ya existe');
      error.codigo = 409;
      error.codigoError = 'CONFLICT';
      usuariosRepository.crear.mockRejectedValue(error);

      const result = await usuariosHandler.crearUsuario(
        eventoAdmin({ nombre: 'Juan', email: 'juan@test.com' }),
        {}
      );

      expect(result.statusCode).toBe(409);
      expect(resolverIdentidad).toHaveBeenCalledTimes(1);
    });

    test('debe retornar 401 cuando no hay identidad Cognito autenticada', async () => {
      const result = await usuariosHandler.crearUsuario({
        body: JSON.stringify({ nombre: 'Juan', email: 'juan@test.com' }),
      }, {});
      expect(result.statusCode).toBe(401);
      expect(resolverIdentidad).not.toHaveBeenCalled();
    });

    test('debe retornar 403 cuando el solicitante es un empleado', async () => {
      usuariosRepository.obtenerPorCognitoSub.mockResolvedValue({
        usuarioId: 'usr_empleado', rol: 'EMPLEADO', estado: 'ACTIVO',
      });
      const result = await usuariosHandler.crearUsuario(
        eventoAdmin({ nombre: 'Juan', email: 'juan@test.com' }),
        {}
      );
      expect(result.statusCode).toBe(403);
      expect(resolverIdentidad).not.toHaveBeenCalled();
      expect(usuariosRepository.crear).not.toHaveBeenCalled();
    });

    test('debe retornar 403 cuando el administrador está inactivo', async () => {
      usuariosRepository.obtenerPorCognitoSub.mockResolvedValue({
        usuarioId: 'usr_admin', rol: 'ADMINISTRADOR', estado: 'INACTIVO',
      });
      const result = await usuariosHandler.crearUsuario(
        eventoAdmin({ nombre: 'Juan', email: 'juan@test.com' }),
        {}
      );
      expect(result.statusCode).toBe(403);
      expect(resolverIdentidad).not.toHaveBeenCalled();
    });
  });

describe('actualizarUsuario', () => {
    it('debe actualizar los datos permitidos de un usuario autenticado', async () => {
      usuariosRepository.obtenerPorCognitoSub.mockResolvedValue({
        usuarioId: 'usr_1',
        cognitoSub: 'sub_123',
        email: 'test@example.com',
        rol: 'EMPLEADO',
        estado: 'ACTIVO',
      });
      usuariosRepository.actualizar.mockResolvedValue({
        usuarioId: 'usr_1',
        nombre: 'Modificado',
      });

      const event = {
        pathParameters: { usuarioId: 'usr_1' },
        requestContext: {
          authorizer: {
            claims: { sub: 'sub_123' },
          },
        },
        body: JSON.stringify({ nombre: 'Modificado' }),
      };

      const result = await usuariosHandler.actualizarUsuario(event, {});
      expect(result.statusCode).toBe(200);
      expect(usuariosRepository.actualizar).toHaveBeenCalledWith('usr_1', { nombre: 'Modificado' });
    });

    it('debe retornar 400 si se intenta cambiar el correo directamente', async () => {
      usuariosRepository.obtenerPorCognitoSub.mockResolvedValue({
        usuarioId: 'usr_1',
        cognitoSub: 'sub_123',
        email: 'original@example.com',
        rol: 'EMPLEADO',
        estado: 'ACTIVO',
      });

      const event = {
        pathParameters: { usuarioId: 'usr_1' },
        requestContext: {
          authorizer: {
            claims: { sub: 'sub_123' },
          },
        },
        body: JSON.stringify({ email: 'nuevo@example.com' }),
      };

      const result = await usuariosHandler.actualizarUsuario(event, {});
      expect(result.statusCode).toBe(400);
      const parsed = JSON.parse(result.body);
      expect(parsed.error.mensaje).toContain('Cognito');
    });

    it('debe retornar 403 si un usuario intenta modificar a otro sin ser admin', async () => {
      usuariosRepository.obtenerPorCognitoSub.mockResolvedValue({
        usuarioId: 'usr_1',
        cognitoSub: 'sub_123',
        rol: 'EMPLEADO',
        estado: 'ACTIVO',
      });

      const event = {
        pathParameters: { usuarioId: 'usr_2' },
        requestContext: {
          authorizer: {
            claims: { sub: 'sub_123' },
          },
        },
        body: JSON.stringify({ nombre: 'Hack' }),
      };

      const result = await usuariosHandler.actualizarUsuario(event, {});
      expect(result.statusCode).toBe(403);
    });
  });

  describe('cambiarRol', () => {
    test('debe cambiar el rol de un usuario', async () => {
      usuariosRepository.cambiarRol.mockResolvedValue({ usuarioId: 'usr_1', rol: 'ADMINISTRADOR' });
      const event = {
        pathParameters: { usuarioId: 'usr_1' },
        body: JSON.stringify({ rol: 'ADMINISTRADOR' }),
      };
      const result = await usuariosHandler.cambiarRol(event, {});
      expect(result.statusCode).toBe(200);
      expect(usuariosRepository.cambiarRol).toHaveBeenCalledWith('usr_1', 'ADMINISTRADOR');
    });

    test('debe retornar 400 con rol inválido', async () => {
      const event = {
        pathParameters: { usuarioId: 'usr_1' },
        body: JSON.stringify({ rol: 'INVALIDO' }),
      };
      const result = await usuariosHandler.cambiarRol(event, {});
      expect(result.statusCode).toBe(400);
    });
  });

  describe('cambiarEstado', () => {
    test('debe activar o desactivar una cuenta', async () => {
      usuariosRepository.cambiarEstado.mockResolvedValue({ usuarioId: 'usr_1', estado: 'INACTIVO' });
      const event = {
        pathParameters: { usuarioId: 'usr_1' },
        body: JSON.stringify({ activo: false }),
      };
      const result = await usuariosHandler.cambiarEstado(event, {});
      expect(result.statusCode).toBe(200);
      expect(usuariosRepository.cambiarEstado).toHaveBeenCalledWith('usr_1', false);
    });
  });
});