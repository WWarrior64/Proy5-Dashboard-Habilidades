const { exito, error } = require('../../utils/responses');
const { CODIGOS, ErrorApp } = require('../../utils/errors');
const colaboradorHabilidadRepository = require('../../repositories/colaborador-habilidad.repository');
const colaboradoresRepository = require('../../repositories/colaboradores.repository');
const usuariosRepository = require('../../repositories/usuarios.repository');
const proyectoHabilidadRepository = require('../../repositories/proyecto-habilidad.repository');
const { evaluarElegibilidad, verificarDisponibilidad } = require('../../services/elegibilidad.service.js');
const { calcularPuntuacionPonderada, normalizarRequisitosProyecto, NIVELES_VALOR } = require('../../services/filtering.service.js');

const NIVELES_JERARQUIA = { JUNIOR: 1, MID: 2, SENIOR: 3 };
const NIVELES_VALIDOS = ['JUNIOR', 'MID', 'SENIOR'];

/**
 * Parsea y valida los parámetros de consulta del buscador.
 * @param {Object} query - queryStringParameters del evento Lambda.
 * @returns {Object} Parametros normalizados o lanza ErrorApp.
 */
function parsearParametros(query) {
  const habilidadesParam = query.habilidades || '';
  const habilidadesRequeridas = [...new Set(
    String(habilidadesParam).split(',').map((id) => id.trim()).filter(Boolean)
  )];

  const proyectoId = query.proyectoId || null;
  const nivelMinimoGeneral = query.nivelMinimo || 'JUNIOR';
  const tipoCoincidencia = query.tipoCoincidencia || 'todas';

  if (query.considerarDisponibilidad !== undefined && !['true', 'false'].includes(query.considerarDisponibilidad)) {
    throw new ErrorApp('considerarDisponibilidad debe ser true o false', 400, CODIGOS.VALIDACION);
  }
  const considerarDisponibilidad = query.considerarDisponibilidad !== 'false';

  const limit = query.limit === undefined ? 50 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ErrorApp('limit debe ser un entero entre 1 y 100', 400, CODIGOS.VALIDACION);
  }

  if (!proyectoId && habilidadesRequeridas.length === 0) {
    throw new ErrorApp('Se requiere al menos una habilidad o un proyectoId', 400, CODIGOS.VALIDACION);
  }

  if (nivelMinimoGeneral && !NIVELES_VALIDOS.includes(nivelMinimoGeneral)) {
    throw new ErrorApp(`nivelMinimo inválido. Valores permitidos: ${NIVELES_VALIDOS.join(', ')}`, 400, CODIGOS.VALIDACION);
  }

  if (!['todas', 'alguna'].includes(tipoCoincidencia)) {
    throw new ErrorApp('tipoCoincidencia debe ser "todas" o "alguna"', 400, CODIGOS.VALIDACION);
  }

  return {
    habilidadesRequeridas,
    proyectoId,
    nivelMinimoGeneral,
    tipoCoincidencia,
    considerarDisponibilidad,
    limit,
  };
}

/**
 * Obtiene los requisitos de habilidades de un proyecto desde el repositorio.
 * @param {string} proyectoId
 * @returns {Array} Requisitos normalizados.
 */
async function obtenerRequisitosProyecto(proyectoId) {
  const requisitosRaw = await proyectoHabilidadRepository.consultarHabilidadesProyecto(proyectoId);
  return normalizarRequisitosProyecto(requisitosRaw);
}

/**
 * Obtiene los colaboradores asociados a una habilidad con paginación completa.
 * @param {string} habilidadId
 * @returns {Array} Todos los colaboradores asociados a la habilidad.
 */
async function obtenerColaboradoresPorHabilidad(habilidadId) {
  const todos = [];
  let lastKey;
  do {
    const resultado = await colaboradorHabilidadRepository.listarPorHabilidad(habilidadId, { lastKey });
    todos.push(...(resultado.items || []));
    lastKey = resultado.lastKey;
  } while (lastKey);
  return todos;
}

async function buscarCandidatos(event, context) {
  try {
    const query = event.queryStringParameters || {};
    const params = parsearParametros(query);

    // Construir requisitos de habilidades
    let requisitos;
    if (params.proyectoId) {
      requisitos = await obtenerRequisitosProyecto(params.proyectoId);
      if (requisitos.length === 0) {
        return error('El proyecto no tiene habilidades requeridas registradas', 404, CODIGOS.NO_ENCONTRADO);
      }
    } else {
      requisitos = params.habilidadesRequeridas.map((h) => ({
        habilidadId: h,
        nivelMinimo: params.nivelMinimoGeneral,
        esObligatoria: false,
        peso: 1,
      }));
    }

    // Paso 1: Obtener colaboradores asociados a al menos una habilidad requerida
    const colaboradoresVistos = new Map();
    const habilidadesRequeridasIds = requisitos.map((r) => r.habilidadId);

    for (const habilidadId of habilidadesRequeridasIds) {
      const relaciones = await obtenerColaboradoresPorHabilidad(habilidadId);
      for (const rel of relaciones) {
        if (!colaboradoresVistos.has(rel.colaboradorId)) {
          colaboradoresVistos.set(rel.colaboradorId, []);
        }
        colaboradoresVistos.get(rel.colaboradorId).push({
          habilidadId: rel.habilidadId,
          nivel: rel.nivel,
          anosExperiencia: rel.anosExperiencia,
          observaciones: rel.observaciones,
        });
      }
    }

    // Paso 2: Para cada colaborador, obtener datos completos y evaluar elegibilidad
    const candidatos = [];
    const usuariosCache = new Map();

    for (const [colaboradorId, habilidadesRel] of colaboradoresVistos) {
      const colaborador = await colaboradoresRepository.obtenerPorId(colaboradorId);
      if (!colaborador) continue;

      let usuario = null;
      if (colaborador.usuarioId) {
        if (!usuariosCache.has(colaborador.usuarioId)) {
          usuariosCache.set(colaborador.usuarioId, await usuariosRepository.obtenerPorId(colaborador.usuarioId));
        }
        usuario = usuariosCache.get(colaborador.usuarioId);
      }

      const disponibilidad = verificarDisponibilidad(colaborador, usuario, params.considerarDisponibilidad);
      if (!disponibilidad.disponible) continue;

      const colaboradorParaEvaluar = {
        colaboradorId,
        usuarioId: colaborador.usuarioId,
        estado: colaborador.estado,
        dedicacionReservada: colaborador.dedicacionReservada,
        habilidades: habilidadesRel.map((h) => ({
          habilidadId: h.habilidadId,
          nivel: h.nivel,
          anosExperiencia: h.anosExperiencia,
          observaciones: h.observaciones,
        })),
      };

      const resultadoEval = evaluarElegibilidad(colaboradorParaEvaluar, requisitos);

      if (!params.proyectoId) {
        const cumpleTodas = resultadoEval.cumplidos.length === requisitos.length;
        const cumpleAlguna = resultadoEval.cumplidos.length > 0;
        const cumpleCondicion = params.tipoCoincidencia === 'todas' ? cumpleTodas : cumpleAlguna;
        if (!cumpleCondicion) continue;
      }

      if (!resultadoEval.elegible) continue;

      const reserva = colaborador.dedicacionReservada;
      const reservaValida = typeof reserva === 'number' && Number.isFinite(reserva) && reserva >= 0 && reserva <= 100;
      const dedicacionReservada = reservaValida ? reserva : null;
      const dedicacionDisponible = reservaValida ? 100 - reserva : null;

      const habilidadesCumplidas = resultadoEval.cumplidos.map((c) => ({
        habilidadId: c.habilidadId,
        nivelPoseido: c.nivelPoseido,
        nivelRequerido: c.nivelRequerido,
        anosExperiencia: c.anosExperiencia,
        observaciones: c.observaciones,
        esObligatoria: c.esObligatoria,
        peso: c.peso,
      }));

      const habilidadesFaltantes = resultadoEval.faltantes.map((f) => ({
        habilidadId: f.habilidadId,
        nivelPoseido: f.nivelPoseido,
        nivelRequerido: f.nivelRequerido,
        anosExperiencia: f.anosExperiencia,
        observaciones: f.observaciones,
        esObligatoria: f.esObligatoria,
        peso: f.peso,
      }));

      const conocidas = new Set([...habilidadesCumplidas.map((h) => h.habilidadId), ...habilidadesFaltantes.map((h) => h.habilidadId)]);
      for (const habilidadId of habilidadesRequeridasIds) {
        if (!conocidas.has(habilidadId)) {
          const req = requisitos.find((r) => r.habilidadId === habilidadId);
          habilidadesFaltantes.push({
            habilidadId,
            nivelPoseido: null,
            nivelRequerido: req ? req.nivelMinimo : params.nivelMinimoGeneral,
            anosExperiencia: null,
            observaciones: null,
            esObligatoria: req ? req.esObligatoria : false,
            peso: req ? req.peso : 1,
          });
        }
      }

      candidatos.push({
        colaboradorId,
        usuarioId: colaborador.usuarioId,
        cargoId: colaborador.cargoId,
        rolProfesional: colaborador.rolProfesional,
        estado: colaborador.estado,
        disponibilidad: disponibilidad.motivo || 'disponible',
        dedicacionReservada,
        dedicacionDisponible,
        puntuacion: resultadoEval.puntuacion,
        elegible: resultadoEval.elegible,
        habilidadesCoincidentes: habilidadesCumplidas,
        habilidadesFaltantes,
        detalles: {
          totalRequisitos: resultadoEval.detalles.totalRequisitos,
          totalCumplidos: resultadoEval.detalles.totalCumplidos,
          totalFaltantes: resultadoEval.detalles.totalFaltantes,
          totalObligatoriosIncumplidos: resultadoEval.detalles.totalObligatoriosIncumplidos,
        },
      });
    }

    // Paso 3: Ordenar por puntuación descendente
    candidatos.sort((a, b) => b.puntuacion - a.puntuacion);

    // Paso 4: Limitar resultados
    const resultados = candidatos.slice(0, params.limit);

    // Construir criterios de respuesta coherentes
    const criterios = {
      tipo: params.proyectoId ? 'proyecto' : 'manual',
      considerarDisponibilidad: params.considerarDisponibilidad,
      limit: params.limit,
    };

    if (params.proyectoId) {
      criterios.proyectoId = params.proyectoId;
      criterios.requisitos = requisitos;
    } else {
      criterios.habilidadesRequeridas = params.habilidadesRequeridas;
      criterios.nivelMinimo = params.nivelMinimoGeneral;
      criterios.tipoCoincidencia = params.tipoCoincidencia;
    }

    return exito({
      total: candidatos.length,
      devueltos: resultados.length,
      candidatos: resultados,
      criterios,
    });
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

async function buscarProyectos(event) {
  try {
    const query = event.queryStringParameters || {};
    const repo = require('../../repositories/proyectos.repository');
    const items = await repo.listarProyectos({ estado: query.estado || 'ACTIVO', liderId: query.liderId, fecha: query.fecha });
    return exito(items.filter((item) => !query.nombre || item.nombre.toLowerCase().includes(query.nombre.toLowerCase())));
  } catch (err) { return error(err.message, err.codigo || 500, err.codigoError); }
}
async function buscarHabilidades(event) {
  try {
    const repo = require('../../repositories/habilidades.repository');
    return exito(await repo.listar(event.queryStringParameters || {}));
  } catch (err) { return error(err.message, err.codigo || 500, err.codigoError); }
}

const { crearDespachador } = require('../../utils/lambda-dispatcher');

const handler = crearDespachador({
  'GET /api/v1/busqueda/colaboradores': buscarCandidatos,
  'GET /api/v1/busqueda/proyectos': buscarProyectos,
  'GET /api/v1/busqueda/habilidades': buscarHabilidades,
});

module.exports = {
  buscarCandidatos,
  buscarProyectos,
  buscarHabilidades,
  handler,
};