const Joi = require('joi');

const ROLES_VALIDOS = ['EMPLEADO', 'RRHH', 'LIDER_PROYECTO', 'ADMINISTRADOR'];
const NIVELES_VALIDOS = ['JUNIOR', 'MID', 'SENIOR'];
const ESTADOS_VALIDOS = ['ACTIVO', 'INACTIVO'];

const idSchema = Joi.string().min(1).max(50).required();
const nombreSchema = Joi.string().min(1).max(100).required();
const emailSchema = Joi.string().email().required();
const cognitoSubSchema = Joi.string().min(1).max(100).required();

// Contrato de entrada de React: cognitoSub, usuarioId y estado se resuelven
// exclusivamente en el backend mediante Cognito y la lógica de registro.
const crearUsuarioSchema = Joi.object({
  nombre: Joi.string().trim().min(1).max(150).required(),
  email: Joi.string().trim().lowercase().email().max(254).required(),
  rol: Joi.string().valid(...ROLES_VALIDOS).default('EMPLEADO'),
});

const actualizarUsuarioSchema = Joi.object({
  nombre: Joi.string().min(1).max(150),
  email: Joi.string().email().max(254),
  rol: Joi.string().valid(...ROLES_VALIDOS),
  estado: Joi.string().valid(...ESTADOS_VALIDOS),
});

const cambiarRolSchema = Joi.object({
  rol: Joi.string().valid(...ROLES_VALIDOS).required(),
});

const cambiarEstadoSchema = Joi.object({
  activo: Joi.boolean().required(),
});

const crearColaboradorSchema = Joi.object({
  colaboradorId: Joi.string().min(1).max(50),
  usuarioId: Joi.string().min(1).max(50).required(),
  cargoId: Joi.string().min(1).max(50).required(),
  rolProfesional: Joi.string().min(1).max(100).required(),
  nombre: Joi.string().min(1).max(100),
  estado: Joi.string().valid(...ESTADOS_VALIDOS).default('ACTIVO'),
  observaciones: Joi.string().max(500).allow('', null),
});

const actualizarColaboradorSchema = Joi.object({
  cargoId: Joi.string().min(1).max(50),
  rolProfesional: Joi.string().min(1).max(100),
  estado: Joi.string().valid(...ESTADOS_VALIDOS),
  observaciones: Joi.string().max(500).allow('', null),
});

const crearCargoSchema = Joi.object({
  cargoId: Joi.string().min(1).max(50),
  nombre: Joi.string().min(1).max(100).required(),
  descripcion: Joi.string().max(500),
  categoria: Joi.string().min(1).max(50).default('GENERAL'),
  estado: Joi.string().valid(...ESTADOS_VALIDOS).default('ACTIVO'),
});

const actualizarCargoSchema = Joi.object({
  nombre: Joi.string().min(1).max(100),
  descripcion: Joi.string().max(500),
  categoria: Joi.string().min(1).max(50),
});

const crearHabilidadSchema = Joi.object({
  habilidadId: Joi.string().min(1).max(50),
  nombre: Joi.string().min(1).max(100).required(),
  categoria: Joi.string().min(1).max(50).default('GENERAL'),
  descripcion: Joi.string().max(500),
  estado: Joi.string().valid(...ESTADOS_VALIDOS).default('ACTIVO'),
});

const actualizarHabilidadSchema = Joi.object({
  nombre: Joi.string().min(1).max(100),
  categoria: Joi.string().min(1).max(50),
  descripcion: Joi.string().max(500),
  estado: Joi.string().valid(...ESTADOS_VALIDOS),
});

const asociarHabilidadSchema = Joi.object({
  colaboradorId: Joi.string().min(1).max(50).required(),
  habilidadId: Joi.string().min(1).max(50).required(),
  nivel: Joi.string().valid(...NIVELES_VALIDOS).required(),
  anosExperiencia: Joi.number().integer().min(0).default(0),
  observaciones: Joi.string().max(500).allow('', null),
});

const actualizarNivelHabilidadSchema = Joi.object({
  nivel: Joi.string().valid(...NIVELES_VALIDOS),
  anosExperiencia: Joi.number().integer().min(0),
  observaciones: Joi.string().max(500).allow('', null),
});

const buscarCandidatosSchema = Joi.object({
  habilidades: Joi.array().items(Joi.string().min(1)).min(1).required(),
  nivelMinimo: Joi.string().valid(...NIVELES_VALIDOS).default('JUNIOR'),
  tipoCoincidencia: Joi.string().valid('todas', 'alguna').default('todas'),
  considerarDisponibilidad: Joi.boolean().default(true),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

function validarUsuario(data) {
  const schema = Joi.object({
    usuarioId: idSchema,
    cognitoSub: cognitoSubSchema,
    nombre: nombreSchema,
    email: emailSchema,
    rol: Joi.string().valid(...ROLES_VALIDOS),
    estado: Joi.string().valid(...ESTADOS_VALIDOS),
  });
  return schema.validate(data, { abortEarly: false });
}

function validarColaborador(data) {
  const schema = Joi.object({
    colaboradorId: Joi.string().min(1).max(50),
    usuarioId: idSchema,
    cargoId: idSchema,
    rolProfesional: nombreSchema,
    estado: Joi.string().valid(...ESTADOS_VALIDOS),
  });
  return schema.validate(data, { abortEarly: false });
}

module.exports = {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  cambiarRolSchema,
  cambiarEstadoSchema,
  crearColaboradorSchema,
  actualizarColaboradorSchema,
  crearCargoSchema,
  actualizarCargoSchema,
  crearHabilidadSchema,
  actualizarHabilidadSchema,
  asociarHabilidadSchema,
  actualizarNivelHabilidadSchema,
  buscarCandidatosSchema,
  validarUsuario,
  validarColaborador,
  ROLES_VALIDOS,
  NIVELES_VALIDOS,
  ESTADOS_VALIDOS,
};