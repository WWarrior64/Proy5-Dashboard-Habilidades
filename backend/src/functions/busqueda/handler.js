const { exito, error } = require('../../utils/responses');
const { CODIGOS } = require('../../utils/errors');
const colaboradorHabilidadRepository = require('../../repositories/colaborador-habilidad.repository');
const colaboradoresRepository = require('../../repositories/colaboradores.repository');

const NIVELES_JERARQUIA = { JUNIOR: 1, MID: 2, SENIOR: 3 };

function obtenerBody(event) {
  if (!event.body) return {};
  if (typeof event.body === 'string') {
    try {
      return JSON.parse(event.body);
    } catch (e) {
      return {};
    }
  }
  return event.body;
}

function obtenerQueryParam(event, nombre) {
  return event.queryStringParameters && event.queryStringParameters[nombre]
    ? event.queryStringParameters[nombre]
    : null;
}

/**
 * Algoritmo de búsqueda de candidatos por coincidencia de habilidades.
 * Utiliza la tabla ColaboradorHabilidad como fuente real de habilidades.
 */
async function buscarCandidatos(event, context) {
  try {
    const body = obtenerBody(event);

    const habilidadesRequeridas = body.habilidades || [];
    const nivelMinimo = body.nivelMinimo || 'JUNIOR';
    const tipoCoincidencia = body.tipoCoincidencia || 'todas'; // 'todas' | 'alguna'
    const considerarDisponibilidad = body.considerarDisponibilidad !== false;
    const limit = parseInt(body.limit || '50', 10);

    if (!Array.isArray(habilidadesRequeridas) || habilidadesRequeridas.length === 0) {
      return error('Se requiere al menos una habilidad en el campo "habilidades"', 400, CODIGOS.VALIDACION);
    }

    const nivelesValidos = ['JUNIOR', 'MID', 'SENIOR'];
    if (!nivelesValidos.includes(nivelMinimo)) {
      return error(`nivelMinimo inválido. Valores permitidos: ${nivelesValidos.join(', ')}`, 400, CODIGOS.VALIDACION);
    }

    if (!['todas', 'alguna'].includes(tipoCoincidencia)) {
      return error('tipoCoincidencia debe ser "todas" o "alguna"', 400, CODIGOS.VALIDACION);
    }

    const nivelMinimoValor = NIVELES_JERARQUIA[nivelMinimo];

    // Paso 1: Para cada habilidad requerida, obtener los colaboradores asociados
    const colaboradoresPorHabilidad = {};
    const habilidadesNoEncontradas = [];

    for (const habilidadId of habilidadesRequeridas) {
      const resultado = await colaboradorHabilidadRepository.listarPorHabilidad(habilidadId);
      const colaboradores = resultado.items;

      if (colaboradores.length === 0) {
        habilidadesNoEncontradas.push(habilidadId);
      }

      colaboradoresPorHabilidad[habilidadId] = colaboradores;
    }

    // Paso 2: Construir mapa de colaborador -> habilidades que cumple
    const colaboradorMap = {};

    for (const habilidadId of habilidadesRequeridas) {
      for (const rel of colaboradoresPorHabilidad[habilidadId] || []) {
        const cid = rel.colaboradorId;
        const nivelValor = NIVELES_JERARQUIA[rel.nivel] || 0;
        const cumpleNivel = nivelValor >= nivelMinimoValor;

        if (!colaboradorMap[cid]) {
          colaboradorMap[cid] = {
            colaboradorId: cid,
            habilidadesCoincidentes: [],
            habilidadesFaltantes: [],
            puntuacion: 0,
            totalRequeridas: habilidadesRequeridas.length,
          };
        }

        if (cumpleNivel) {
          colaboradorMap[cid].habilidadesCoincidentes.push({
            habilidadId,
            nivelPoseido: rel.nivel,
            nivelRequerido: nivelMinimo,
            anosExperiencia: rel.anosExperiencia,
            observaciones: rel.observaciones,
          });
        } else {
          colaboradorMap[cid].habilidadesFaltantes.push({
            habilidadId,
            nivelPoseido: rel.nivel,
            nivelRequerido: nivelMinimo,
          });
        }
      }
    }

    // Paso 3: Filtrar por tipo de coincidencia y obtener datos de colaboradores
    const candidatos = [];

    for (const [colaboradorId, info] of Object.entries(colaboradorMap)) {
      const cumpleTodas = info.habilidadesCoincidentes.length === habilidadesRequeridas.length;
      const cumpleAlguna = info.habilidadesCoincidentes.length > 0;

      let cumpleCondicion = false;
      if (tipoCoincidencia === 'todas') {
        cumpleCondicion = cumpleTodas;
      } else {
        cumpleCondicion = cumpleAlguna;
      }

      if (!cumpleCondicion) continue;

      // Obtener datos del colaborador
      const colaborador = await colaboradoresRepository.obtenerPorId(colaboradorId);
      if (!colaborador) continue;

      // Considerar disponibilidad y estado
      if (considerarDisponibilidad) {
        if (colaborador.estado !== 'ACTIVO') continue;
      }

      // Calcular puntuación (0-100)
      const coincidencias = info.habilidadesCoincidentes.length;
      const puntuacion = Math.round((coincidencias / habilidadesRequeridas.length) * 100);

      candidatos.push({
        colaboradorId,
        usuarioId: colaborador.usuarioId,
        cargoId: colaborador.cargoId,
        rolProfesional: colaborador.rolProfesional,
        estado: colaborador.estado,
        puntuacion,
        habilidadesCoincidentes: info.habilidadesCoincidentes,
        habilidadesFaltantes: info.habilidadesFaltantes,
        cumpleTodas,
        cumpleAlguna,
      });
    }

    // Paso 4: Ordenar por puntuación descendente
    candidatos.sort((a, b) => b.puntuacion - a.puntuacion);

    // Paso 5: Limitar resultados
    const resultados = candidatos.slice(0, limit);

    return exito({
      total: resultados.length,
      candidatos: resultados,
      criterios: {
        habilidadesRequeridas,
        nivelMinimo,
        tipoCoincidencia,
        considerarDisponibilidad,
      },
    });
  } catch (err) {
    return error(err.message, err.codigo || 500, err.codigoError);
  }
}

module.exports = {
  buscarCandidatos,
};