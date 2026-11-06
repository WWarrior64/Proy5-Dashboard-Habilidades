const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { tableUsuarios } = require('../../src/config/environment.js');

// Activación explícita: nunca contactar AWS durante la suite local por accidente.
const describeIntegration = process.env.RUN_AWS_INTEGRATION === 'true' ? describe : describe.skip;
describeIntegration('Integración con DynamoDB (entorno de desarrollo)', () => {
  test('DescribeTable responde correctamente para la tabla de usuarios', async () => {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
      ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
    });

    const tableName = process.env.TABLE_USUARIOS || tableUsuarios;

    const command = new DescribeTableCommand({ TableName: tableName });
    try {
      const response = await client.send(command);
      expect(response.Table).toBeDefined();
      expect(response.Table.TableName).toBe(tableName);
      expect(response.Table.TableStatus).toBe('ACTIVE');
    } finally {
      client.destroy();
    }
  }, 30000);
});