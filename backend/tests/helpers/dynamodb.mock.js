const sdk = require('@aws-sdk/lib-dynamodb');

// Cada prueba configura respuestas por tipo de comando, no métodos del SDK v2.
function crearMockDynamoDb() {
  const commandNames = [
    'GetCommand', 'PutCommand', 'UpdateCommand', 'DeleteCommand',
    'QueryCommand', 'ScanCommand', 'TransactWriteCommand', 'TransactGetCommand',
  ];
  const commandMocks = Object.fromEntries(commandNames.map((name) => [name, jest.fn()]));
  const dynamoDb = {
    send: jest.fn(async (command) => {
      const name = commandNames.find((key) => command instanceof sdk[key]);
      if (!name) throw new Error('Se esperaba un comando de @aws-sdk/lib-dynamodb');
      return commandMocks[name](command.input);
    }),
  };
  return { ...sdk, dynamoDb, commandMocks, client: {} };
}

module.exports = { crearMockDynamoDb };