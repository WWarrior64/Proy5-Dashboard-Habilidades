const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { tableUsuarios } = require('../../src/config/environment.js');

// Esta prueba de integración requiere credenciales de AWS configuradas.
// Se salta automáticamente si no hay credenciales disponibles (por ejemplo, en CI sin AWS).
describe('Integración con DynamoDB (entorno de desarrollo)', () => {
  test('DescribeTable responde correctamente para la tabla de usuarios', async () => {
    const hasCredentials = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE;
    if (!hasCredentials) {
      console.log('SALTADO: No hay credenciales de AWS configuradas. Prueba de integración requiere AWS_PROFILE o variables de entorno.');
      return;
    }

    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
      ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
    });

    const tableName = process.env.TABLE_USUARIOS || tableUsuarios;

    const command = new DescribeTableCommand({ TableName: tableName });
    const response = await client.send(command);

    expect(response.Table).toBeDefined();
    expect(response.Table.TableName).toBe(tableName);
    expect(response.Table.TableStatus).toBe('ACTIVE');
  });
});