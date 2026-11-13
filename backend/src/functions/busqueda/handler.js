const { exito, error } = require('../../utils/responses');
const { CODIGOS } = require('../../utils/errors');
const colaboradorHabilidadRepository = require('../../repositories/colaborador-habilidad.repository');
const colaboradoresRepository = require('../../repositories/colaboradores.repository');

const NIVELES_JERARQUIA = { JUNIOR: 1, MID: 2, SENIOR: 3 };

/**
 * Algoritmo de búsqueda de candidatos por coincidencia de habilidades.
 * Utiliza la tabla ColaboradorHabilidad como fuente real de habilidades.
 */
async function buscarCandidatos(event, context) {
  try {
    const query = event.queryStringParameters || {};
    const habilidadesRequeridas = [...new Set(String(query.habilidades || '').split(',').map((id) => id.trim()).filter(Boolean))];
    const nivelMinimo = query.nivelMinimo || 'JUNIOR';
    const tipoCoincidencia = query.tipoCoincidencia || 'todas';
    if (query.considerarDisponibilidad !== undefined && !['true', 'false'].includes(query.considerarDisponibilidad)) {
      return error('considerarDisponibilidad debe ser true o false', 400, CODIGOS.VALIDACION);
    }
    const considerarDisponibilidad = query.considerarDisponibilidad !== 'false';
    const limit = query.limit === undefined ? 50 : Number(query.limit);

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

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return error('limit debe ser un entero entre 1 y 100', 400, CODIGOS.VALIDACION);
    const nivelMinimoValor = NIVELES_JERARQUIA[nivelMinimo];

    // Paso 1: Para cada habilidad requerida, obtener los colaboradores asociados
    const colaboradoresPorHabilidad = {};

    for (const habilidadId of habilidadesRequeridas) {
      const colaboradores = [];
      let lastKey;
      do {
        const resultado = await colaboradorHabilidadRepository.listarPorHabilidad(habilidadId, { lastKey });
        colaboradores.push(...resultado.items);
        lastKey = resultado.lastKey;
      } while (lastKey);

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

      // Un colaborador inactivo nunca es candidato válido. La dedicación reservada
      // se actualiza transaccionalmente cuando se crean o desvinculan asignaciones.
      if (colaborador.estado !== 'ACTIVO') continue;
      const reserva = colaborador.dedicacionReservada;
      const reservaValida = typeof reserva === 'number' && Number.isFinite(reserva) && reserva >= 0 && reserva <= 100;
      const dedicacionReservada = reservaValida ? reserva : null;
      const dedicacionDisponible = reservaValida ? 100 - reserva : null;
      // Los registros antiguos sin reserva calculada deben migrarse antes de declarar disponibilidad.
      if (considerarDisponibilidad && (!reservaValida || dedicacionDisponible <= 0)) continue;

      // Registrar también las habilidades que el colaborador no posee en absoluto.
      const conocidas = new Set([
        ...info.habilidadesCoincidentes.map((h) => h.habilidadId),
        ...info.habilidadesFaltantes.map((h) => h.habilidadId),
      ]);
      for (const habilidadId of habilidadesRequeridas) {
        if (!conocidas.has(habilidadId)) {
          info.habilidadesFaltantes.push({ habilidadId, nivelPoseido: null, nivelRequerido: nivelMinimo });
        }
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
        dedicacionReservada,
        dedicacionDisponible,
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
      total: candidatos.length,
      devueltos: resultados.length,
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