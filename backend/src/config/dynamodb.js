const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-2',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
  // Se utiliza la cadena predeterminada de credenciales del SDK v3:
  // - Localmente: perfil de AWS CLI (AWS_PROFILE) o IAM Identity Center.
  // - En Lambda: credenciales temporales del rol de ejecución.
  // No se declaran claves AWS directamente en el código.
});

const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

module.exports = {
  dynamoDb,
  client,
};