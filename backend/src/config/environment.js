require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  awsRegion: process.env.AWS_REGION || 'us-east-2',
  awsProfile: process.env.AWS_PROFILE,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'cambiar_en_produccion',

  // Endpoint local de DynamoDB (solo para pruebas locales, opcional)
  dynamoDbEndpoint: process.env.DYNAMODB_ENDPOINT,

  // Configuración de caché (opcional, para el desarrollador 3)
  cacheEnabled: process.env.CACHE_ENABLED === 'true',
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 300,

  // Nombres físicos de las nueve tablas DynamoDB
  tableUsuarios: process.env.TABLE_USUARIOS || 'im_usuarios',
  tableColaboradores: process.env.TABLE_COLABORADORES || 'im_colaboradores',
  tableCargos: process.env.TABLE_CARGOS || 'im_cargos',
  tableHabilidades: process.env.TABLE_HABILIDADES || 'im_habilidades',
  tableColaboradorHabilidad: process.env.TABLE_COLABORADOR_HABILIDAD || 'im_colaborador_habilidad',
  tableProyectos: process.env.TABLE_PROYECTOS || 'im_proyectos',
  tableProyectoHabilidad: process.env.TABLE_PROYECTO_HABILIDAD || 'im_proyecto_habilidad',
  tablePostulaciones: process.env.TABLE_POSTULACIONES || 'im_postulaciones',
  tableAsignaciones: process.env.TABLE_ASIGNACIONES || 'im_asignaciones',
};