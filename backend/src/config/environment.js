require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  awsRegion: process.env.AWS_REGION || 'us-east-2',
  awsProfile: process.env.AWS_PROFILE,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Endpoint local de DynamoDB (solo para pruebas locales, opcional)
  dynamoDbEndpoint: process.env.DYNAMODB_ENDPOINT,

  // Configuración de caché (opcional, para el desarrollador 3)
  cacheEnabled: process.env.CACHE_ENABLED === 'true',
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 300,

  // Nombres físicos de las nueve tablas DynamoDB (convención: internal-marketplace-<entidad>-<entorno>)
  // Los valores por defecto apuntan al entorno de desarrollo (-dev). En producción deben definirse
  // las variables de entorno TABLE_* con el sufijo -prod (ej. TABLE_USUARIOS=internal-marketplace-usuarios-prod).
  tableUsuarios: process.env.TABLE_USUARIOS || 'internal-marketplace-usuarios-dev',
  tableColaboradores: process.env.TABLE_COLABORADORES || 'internal-marketplace-colaboradores-dev',
  tableCargos: process.env.TABLE_CARGOS || 'internal-marketplace-cargos-dev',
  tableHabilidades: process.env.TABLE_HABILIDADES || 'internal-marketplace-habilidades-dev',
  tableColaboradorHabilidad:
    process.env.TABLE_COLABORADOR_HABILIDAD || 'internal-marketplace-colaborador-habilidad-dev',
  tableProyectos: process.env.TABLE_PROYECTOS || 'internal-marketplace-proyectos-dev',
  tableProyectoHabilidad:
    process.env.TABLE_PROYECTO_HABILIDAD || 'internal-marketplace-proyecto-habilidad-dev',
  tablePostulaciones: process.env.TABLE_POSTULACIONES || 'internal-marketplace-postulaciones-dev',
  tableAsignaciones: process.env.TABLE_ASIGNACIONES || 'internal-marketplace-asignaciones-dev',
  tableAdministracion: process.env.TABLE_ADMINISTRACION || 'internal-marketplace-administracion-dev',
  tableAuditoria: process.env.TABLE_AUDITORIA || 'internal-marketplace-auditoria-dev',
};

const TABLE_KEYS = [
  'TABLE_USUARIOS',
  'TABLE_COLABORADORES',
  'TABLE_CARGOS',
  'TABLE_HABILIDADES',
  'TABLE_COLABORADOR_HABILIDAD',
  'TABLE_PROYECTOS',
  'TABLE_PROYECTO_HABILIDAD',
  'TABLE_POSTULACIONES',
  'TABLE_ASIGNACIONES',
  'TABLE_ADMINISTRACION',
  'TABLE_AUDITORIA',
];

/**
 * Valida que todas las variables de entorno de nombres de tablas estén definidas.
 * Se invoca solo cuando se va a acceder a DynamoDB, no afecta a pruebas unitarias con mocks
 * ni al endpoint Health (que no usa tablas).
 * @returns {Array<string>} lista de variables faltantes (vacía si todo está definido)
 */
function validarTablasConfiguradas() {
  return TABLE_KEYS.filter((key) => !process.env[key]);
}

module.exports.validarTablasConfiguradas = validarTablasConfiguradas;