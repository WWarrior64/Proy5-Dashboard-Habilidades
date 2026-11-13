const enabled = process.env.RUN_LOCAL_INTEGRATION === 'true';
const suite = enabled ? describe : describe.skip;

suite('Contratos y concurrencia con DynamoDB Local', () => {
  let db;
  let low;
  let env;
  let sdk;
  let lowSdk;
  const tables = [];
  beforeAll(async () => {
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(endpoint || '')) throw new Error('Solo se permite DynamoDB Local');
    process.env.AWS_ACCESS_KEY_ID = 'local';
    process.env.AWS_SECRET_ACCESS_KEY = 'local';
    process.env.AWS_REGION = 'us-east-2';
    const prefix = `test_${Date.now()}_`;
    for (const key of ['USUARIOS', 'COLABORADORES', 'CARGOS', 'HABILIDADES', 'COLABORADOR_HABILIDAD', 'PROYECTOS', 'PROYECTO_HABILIDAD', 'POSTULACIONES', 'ASIGNACIONES']) {
      process.env[`TABLE_${key}`] = prefix + key.toLowerCase();
    }
    jest.resetModules();
    env = require('../../src/config/environment');
    ({ dynamoDb: db, client: low } = require('../../src/config/dynamodb'));
    sdk = require('@aws-sdk/lib-dynamodb');
    lowSdk = require('@aws-sdk/client-dynamodb');
    const schemas = [
      [env.tableUsuarios, ['usuarioId'], [['cognitoSub'], ['correo']]],
      [env.tableColaboradores, ['colaboradorId'], [['usuarioId'], ['estado', 'rolProfesional#nombre']]],
      [env.tableCargos, ['cargoId'], [['estado', 'nombre']]],
      [env.tableHabilidades, ['habilidadId'], [['categoria', 'nombreNormalizado']]],
      [env.tableColaboradorHabilidad, ['colaboradorId', 'habilidadId'], [['habilidadId', 'nivelColaboradorKey']]],
      [env.tableProyectos, ['proyectoId'], [['estado', 'fechaPublicacionKey'], ['liderId', 'estadoFechaKey']]],
      [env.tableProyectoHabilidad, ['proyectoId', 'habilidadId'], [['habilidadId', 'proyectoId']]],
      [env.tablePostulaciones, ['proyectoId', 'postulacionKey'], [['colaboradorId', 'colaboradorFechaKey']]],
      [env.tableAsignaciones, ['asignacionId'], [['colaboradorId', 'colaboradorFechaKey'], ['proyectoId', 'proyectoFechaKey'], ['estado', 'estadoFechaKey']]],
    ];
    const keySchema = (keys) => keys.map((AttributeName, i) => ({ AttributeName, KeyType: i ? 'RANGE' : 'HASH' }));
    for (const [TableName, keys, indexes] of schemas) {
      await low.send(new lowSdk.CreateTableCommand({
        TableName, BillingMode: 'PAY_PER_REQUEST', KeySchema: keySchema(keys),
        AttributeDefinitions: [...new Set([...keys, ...indexes.flat()])].map((AttributeName) => ({ AttributeName, AttributeType: 'S' })),
        GlobalSecondaryIndexes: indexes.map((index, i) => ({ IndexName: `GSI${i + 1}`, KeySchema: keySchema(index), Projection: { ProjectionType: 'ALL' } })),
      }));
      tables.push(TableName);
    }
  }, 60000);
  afterAll(async () => {
    if (low) {
      for (const TableName of tables) await low.send(new lowSdk.DeleteTableCommand({ TableName }));
      low.destroy();
    }
  });

  test('CRUD, índices, unicidad y reserva concurrente en los nueve contratos', async () => {
    const usuarios = require('../../src/repositories/usuarios.repository');
    const cargos = require('../../src/repositories/cargos.repository');
    const colaboradores = require('../../src/repositories/colaboradores.repository');
    const habilidades = require('../../src/repositories/habilidades.repository');
    const relaciones = require('../../src/repositories/colaborador-habilidad.repository');
    const proyectos = require('../../src/repositories/proyectos.repository');
    const proyectoHabilidad = require('../../src/repositories/proyecto-habilidad.repository');
    const postulaciones = require('../../src/repositories/postulaciones.repository');
    const asignaciones = require('../../src/repositories/asignaciones.repository');
    await usuarios.crear({ usuarioId: 'u1', cognitoSub: 'sub1', nombre: 'Líder', email: 'LIDER@example.com', rol: 'LIDER_PROYECTO' });
    await usuarios.crear({ usuarioId: 'u2', cognitoSub: 'sub2', nombre: 'Colaborador', email: 'colaborador@example.com', rol: 'EMPLEADO' });
    await usuarios.crear({ usuarioId: 'u3', cognitoSub: 'sub3', nombre: 'Postulante', email: 'postulante@example.com', rol: 'EMPLEADO' });
    expect((await usuarios.obtenerPorCognitoSub('sub1')).usuarioId).toBe('u1');
    await cargos.crear({ cargoId: 'c1', nombre: 'Dev' });
    expect((await cargos.listar({ estado: 'ACTIVO' })).items).toHaveLength(1);
    await colaboradores.crear({ colaboradorId: 'col1', usuarioId: 'u2', cargoId: 'c1', rolProfesional: 'Dev' });
    await colaboradores.crear({ colaboradorId: 'col2', usuarioId: 'u3', cargoId: 'c1', rolProfesional: 'Dev' });
    expect((await colaboradores.obtenerPorUsuarioId('u2')).colaboradorId).toBe('col1');
    await habilidades.crear({ habilidadId: 'h1', nombre: 'JavaScript' });
    await expect(habilidades.crear({ habilidadId: 'h2', nombre: ' javascript ' })).rejects.toMatchObject({ codigo: 409 });
    await habilidades.actualizar('h1', { nombre: 'Node' });
    expect((await habilidades.obtenerPorNombreNormalizado('node')).habilidadId).toBe('h1');
    await relaciones.asociar({ colaboradorId: 'col1', habilidadId: 'h1', nivel: 'SENIOR' });
    expect((await relaciones.listarPorHabilidad('h1')).items).toHaveLength(1);
    await proyectos.crearProyecto({ proyectoId: 'p1', nombre: 'Proyecto', descripcion: 'Prueba', liderId: 'u1', horasRequeridas: 100, creadoPor: 'u1', estado: 'BORRADOR' });
    await proyectoHabilidad.asociarHabilidad({ proyectoId: 'p1', habilidadId: 'h1', nivelMinimo: 'JUNIOR', esObligatoria: true, peso: 1 });
    await proyectos.cambiarEstado('p1', 'ACTIVO');
    expect(await proyectos.listarProyectos({ estado: 'ACTIVO' })).toHaveLength(1);
    expect(await proyectoHabilidad.consultarProyectosPorHabilidad('h1')).toHaveLength(1);
    await postulaciones.crearPostulacion({ proyectoId: 'p1', colaboradorId: 'col2' });
    expect(await postulaciones.consultarPostulacionesColaborador('col2')).toHaveLength(1);
    const results = await Promise.allSettled(['a1', 'a2'].map((asignacionId) => asignaciones.crearAsignacion({
      asignacionId, colaboradorId: 'col1', proyectoId: 'p1', porcentajeDedicacion: 60, horasAsignadas: 50, creadoPor: 'u1',
    })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const winner = results.find((result) => result.status === 'fulfilled').value;
    const current = await db.send(new sdk.GetCommand({ TableName: env.tableColaboradores, Key: { colaboradorId: 'col1' }, ConsistentRead: true }));
    expect(current.Item.dedicacionReservada).toBe(60);
    await asignaciones.actualizarAsignacion(winner.asignacionId, { porcentajeDedicacion: 40 });
    await asignaciones.desvincularAsignacion(winner.asignacionId);
    const released = await colaboradores.obtenerPorId('col1');
    expect(released.dedicacionReservada).toBe(0);
    await postulaciones.aceptarPostulacion('p1', 'col2', { revisadoPor: 'u1', porcentajeDedicacion: 50, horasAsignadas: 20 });
    expect((await colaboradores.obtenerPorId('col2')).dedicacionReservada).toBe(50);
    await relaciones.retirar('col1', 'h1');
    expect(await relaciones.listarPorColaborador('col1')).toEqual([]);
  }, 60000);
});