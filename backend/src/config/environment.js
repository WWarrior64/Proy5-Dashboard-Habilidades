require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'cambiar_en_produccion',

  // Nombres de las nueve tablas DynamoDB
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