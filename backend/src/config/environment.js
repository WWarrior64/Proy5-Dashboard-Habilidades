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
  tableUsuarios: process.env.TABLE_USUARIOS || 'internal-marketplace-usuarios-dev',
  tableColaboradores: process.env.TABLE_COLABORADORES || 'internal-marketplace-colaboradores-dev',
  tableCargos: process.env.TABLE_CARGOS || 'internal-marketplace-cargos-dev',
  tableHabilidades: process.env.TABLE_HABILIDADES || 'internal-marketplace-habilidades-dev',
  tableColaboradorHabilidad: process.env.TABLE_COLABORADOR_HABILIDAD || 'internal-marketplace-colaborador-habilidad-dev',
  tableProyectos: process.env.TABLE_PROYECTOS || 'internal-marketplace-proyectos-dev',
  tableProyectoHabilidad: process.env.TABLE_PROYECTO_HABILIDAD || 'internal-marketplace-proyecto-habilidad-dev',
  tablePostulaciones: process.env.TABLE_POSTULACIONES || 'internal-marketplace-postulaciones-dev',
  tableAsignaciones: process.env.TABLE_ASIGNACIONES || 'internal-marketplace-asignaciones-dev',
};