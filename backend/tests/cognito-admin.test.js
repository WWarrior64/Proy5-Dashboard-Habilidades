process.env.COGNITO_USER_POOL_ID = 'us-east-2_dummyPoolId';
process.env.AWS_REGION = 'us-east-2';

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  ListUsersCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

jest.mock('@aws-sdk/client-cognito-identity-provider');

const { resolverIdentidad } = require('../src/services/cognito-admin.service');

describe('Servicio Cognito Admin - resolverIdentidad', () => {
  let mockSend;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend = jest.fn();
    CognitoIdentityProviderClient.prototype.send = mockSend;
  });

  it('debe crear un usuario en Cognito y retornar cognitoSub cuando no existe previamente', async () => {
    // 1. buscarUsuarioPorCorreo: retorna vacío o lanza UserNotFound
    mockSend.mockImplementation(async (command) => {
      if (command instanceof ListUsersCommand || command.constructor.name === 'ListUsersCommand') {
        return { Users: [] };
      }
      if (command instanceof AdminCreateUserCommand || command.constructor.name === 'AdminCreateUserCommand') {
        return {
          User: {
            Attributes: [
              { Name: 'sub', Value: 'sub_cognito_nuevo_123' },
              { Name: 'email', Value: 'nuevo@empresa.com' },
            ],
          },
        };
      }
      if (command instanceof AdminGetUserCommand || command.constructor.name === 'AdminGetUserCommand') {
        const error = new Error('User not found');
        error.name = 'UserNotFoundException';
        throw error;
      }
      return {};
    });

    const resultado = await resolverIdentidad({
      email: 'nuevo@empresa.com',
      nombre: 'Nuevo Usuario',
    });

    expect(resultado).toEqual({
      cognitoSub: 'sub_cognito_nuevo_123',
      creadoEnCognito: true,
    });
  });

  it('debe recuperar el cognitoSub existente si el usuario ya está registrado en Cognito', async () => {
    mockSend.mockImplementation(async (command) => {
      // Simula que buscarUsuarioPorCorreo encuentra el usuario
      if (command instanceof ListUsersCommand || command.constructor.name === 'ListUsersCommand') {
        return {
          Users: [
            {
              Username: 'existente@empresa.com',
              Attributes: [
                { Name: 'sub', Value: 'sub_cognito_existente_456' },
                { Name: 'email', Value: 'existente@empresa.com' },
              ],
            },
          ],
        };
      }
      if (command instanceof AdminGetUserCommand || command.constructor.name === 'AdminGetUserCommand') {
        return {
          UserAttributes: [
            { Name: 'sub', Value: 'sub_cognito_existente_456' },
            { Name: 'email', Value: 'existente@empresa.com' },
          ],
        };
      }
      return {};
    });

    const resultado = await resolverIdentidad({
      email: 'existente@empresa.com',
      nombre: 'Usuario Existente',
    });

    expect(resultado).toEqual({
      cognitoSub: 'sub_cognito_existente_456',
      creadoEnCognito: false,
    });
  });

  it('debe propagar el error si ocurre un fallo no recuperable en Cognito', async () => {
    mockSend.mockRejectedValue(new Error('Internal Cognito Error'));

    await expect(
      resolverIdentidad({ email: 'fallo@empresa.com', nombre: 'Fallo' })
    ).rejects.toThrow('No se pudo consultar Cognito');
  });
});