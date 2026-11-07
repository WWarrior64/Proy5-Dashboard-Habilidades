const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

describe('Conexión a DynamoDB', () => {
  test.each([
    'GetCommand', 'PutCommand', 'UpdateCommand', 'DeleteCommand',
    'QueryCommand', 'ScanCommand', 'TransactWriteCommand', 'TransactGetCommand',
  ])('exporta %s desde lib-dynamodb con su input intacto', (name) => {
    const config = require('../src/config/dynamodb.js');
    const sdk = require('@aws-sdk/lib-dynamodb');
    expect(config[name]).toBe(sdk[name]);
    const input = { TableName: 'tabla-prueba' };
    expect(new config[name](input).input).toBe(input);
  });
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