const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { ErrorApp, CODIGOS } = require('../utils/errors');

const client = new CognitoIdentityProviderClient({});
const userPoolId = () => process.env.COGNITO_USER_POOL_ID;

function attribute(user, name) {
  return user?.Attributes?.find((a) => a.Name === name)?.Value || null;
}

// Esta consulta se ejecuta únicamente desde Lambda con IAM, nunca desde React.
async function buscarUsuarioPorCorreo(email) {
  const normalized = email.trim().toLowerCase();
  const result = await client.send(new ListUsersCommand({
    UserPoolId: userPoolId(),
    Filter: `email = "${normalized.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    Limit: 10,
  }));
  const matches = (result.Users || []).filter((u) =>
    attribute(u, 'email')?.trim().toLowerCase() === normalized
  );
  if (matches.length > 1) {
    throw new ErrorApp('Hay múltiples cuentas Cognito con ese correo; revise las identidades antes de continuar', 409, CODIGOS.CONFLICTO);
  }
  return matches[0] || null;
}

async function resolverIdentidad({ email, nombre }) {
  if (!userPoolId()) throw new ErrorApp('Falta COGNITO_USER_POOL_ID en Lambda', 500, CODIGOS.INTERNO);
  let user;
  try {
    user = await buscarUsuarioPorCorreo(email);
  } catch (e) {
    if (e instanceof ErrorApp) throw e;
    throw new ErrorApp('No se pudo consultar Cognito', 502, CODIGOS.INTERNO);
  }
  if (user) {
    const sub = attribute(user, 'sub');
    if (!sub) throw new ErrorApp('La cuenta Cognito no tiene sub', 409, CODIGOS.CONFLICTO);
    return { cognitoSub: sub, creadoEnCognito: false };
  }

  try {
    const result = await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId(),
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: nombre },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    }));
    const sub = attribute(result.User, 'sub');
    if (!sub) throw new Error('La respuesta no contiene el sub');
    return { cognitoSub: sub, creadoEnCognito: true };
  } catch (e) {
    if (e.name === 'UsernameExistsException' || e.name === 'AliasExistsException') {
      // Puede ocurrir por altas concurrentes; se resuelve de manera idempotente en un reintento.
      throw new ErrorApp('La cuenta Cognito ya existe; reintente la operación', 409, CODIGOS.CONFLICTO);
    }
    throw new ErrorApp('No se pudo crear o invitar la cuenta en Cognito. Revise la configuración de correo del User Pool', 502, CODIGOS.INTERNO);
  }
}

module.exports = { resolverIdentidad };
