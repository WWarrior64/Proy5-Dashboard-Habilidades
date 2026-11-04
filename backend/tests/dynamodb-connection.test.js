const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

describe('Conexión a DynamoDB', () => {
  test('El cliente DynamoDBClient se inicializa sin errores con la región configurada', () => {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
    });
    expect(client).toBeDefined();
    expect(client.config).toBeDefined();
  });

  test('DynamoDBDocumentClient se crea a partir del cliente', () => {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
    });
    const docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
    expect(docClient).toBeDefined();
  });

  test('El módulo de configuración exporta el cliente y document client de DynamoDB', () => {
    const mod = require('../src/config/dynamodb.js');
    expect(mod.dynamoDb).toBeDefined();
    expect(mod.client).toBeDefined();
  });
});