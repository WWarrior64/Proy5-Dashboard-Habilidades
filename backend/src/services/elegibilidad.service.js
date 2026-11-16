const { NIVELES_VALOR } = require('./filtering.service.js');
const { ErrorApp, CODIGOS } = require('../utils/errors.js');

const NIVELES_VALIDOS = ['JUNIOR', 'MID', 'SENIOR'];

function validarRequisito(requisito) {
  if (!requisito || typeof requisito !== 'object') {
    throw new ErrorApp('Cada requisito debe ser un objeto', 400, CODIGOS.VALIDACION);
  }
  if (!requisito.habilidadId) {
    throw new ErrorApp('El requisito debe incluir habilidadId', 400, CODIGOS.VALIDACION);
  }
  if (requisito.nivelMinimo !== undefined && !NIVELES_VALIDOS.includes(requisito.nivelMinimo)) {
    throw new ErrorApp(`nivelMinimo inválido. Valores: ${NIVELES_VALIDOS.join(', ')}`, 400, CODIGOS.VALIDACION);
  }
  if (requisito.esObligatoria !== undefined && typeof requisito.esObligatoria !== 'boolean') {
    throw new ErrorApp('esObligatoria debe ser booleano', 400, CODIGOS.VALIDACION);
  }
  if (requisito.peso !== undefined && (!Number.isFinite(requisito.peso) || requisito.peso < 0)) {
    throw new ErrorApp('peso debe ser un número mayor o igual a 0', 400, CODIGOS.VALIDACION);
  }
}

function normalizarRequisitos(requisitos = []) {
  if (!Array.isArray(requisitos)) {
    throw new ErrorApp('Los requisitos deben ser un arreglo', 400, CODIGOS.VALIDACION);
  }
  return requisitos.map((r) => {
    validarRequisito(r);
    return {
      habilidadId: r.habilidadId,
      nivelMinimo: r.nivelMinimo || 'JUNIOR',
      esObligatoria: r.esObligatoria !== undefined ? r.esObligatoria : false,
      peso: r.peso !== undefined && r.peso !== null ? Number(r.peso) : 1,
      observaciones: r.observaciones || null,
    };
  });
}

function cumpleNivelRequisito(nivelPoseido, nivelRequerido) {
  const valorPoseido = NIVELES_VALOR[nivelPoseido] || 0;
  const valorRequerido = NIVELES_VALOR[nivelRequerido] || 0;
  return valorPoseido >= valorRequerido;
}

function evaluarElegibilidad(colaborador, requisitos = []) {
  const requisitosNorm = normalizarRequisitos(requisitos);

  const habilidadesColaborador = {};
  const habilidadesColaboradorRaw = Array.isArray(colaborador.habilidades) ? colaborador.habilidades : [];
  for (const h of habilidadesColaboradorRaw) {
    if (h.habilidadId) {
      habilidadesColaborador[h.habilidadId] = h;
    }
  }

  const cumplidos = [];
  const faltantes = [];
  const obligatoriosIncumplidos = [];
  let pesoTotal = 0;
  let pesoCumplido = 0;

  for (const req of requisitosNorm) {
    const hab = habilidadesColaborador[req.habilidadId];
    const nivelPoseido = hab ? hab.nivel : null;
    const cumple = hab ? cumpleNivelRequisito(nivelPoseido, req.nivelMinimo) : false;

    const detalle = {
      habilidadId: req.habilidadId,
      nivelRequerido: req.nivelMinimo,
      nivelPoseido,
      cumple,
      esObligatoria: req.esObligatoria,
      peso: req.peso,
      anosExperiencia: hab ? hab.anosExperiencia : null,
      observaciones: hab ? hab.observaciones : null,
    };

    pesoTotal += req.peso;

    if (cumple) {
      cumplidos.push(detalle);
      pesoCumplido += req.peso;
    } else {
      faltantes.push(detalle);
      if (req.esObligatoria) {
        obligatoriosIncumplidos.push(detalle);
      }
    }
  }

  const elegible = obligatoriosIncumplidos.length === 0;

  let puntuacion = 0;
  if (elegible && pesoTotal > 0) {
    puntuacion = Math.round((pesoCumplido / pesoTotal) * 100);
  }

  return {
    elegible,
    puntuacion: Math.max(0, Math.min(100, puntuacion)),
    cumplidos,
    faltantes,
    obligatoriosIncumplidos,
    detalles: {
      totalRequisitos: requisitosNorm.length,
      totalCumplidos: cumplidos.length,
      totalFaltantes: faltantes.length,
      totalObligatoriosIncumplidos: obligatoriosIncumplidos.length,
      pesoTotal,
      pesoCumplido,
    },
  };
}

function verificarDisponibilidad(colaborador, usuario = null, considerarDisponibilidad = true) {
  if (!colaborador) {
    return { disponible: false, motivo: 'Colaborador no encontrado' };
  }

  if (colaborador.estado !== 'ACTIVO') {
    return { disponible: false, motivo: 'Colaborador inactivo' };
  }

  if (usuario && usuario.estado !== 'ACTIVO') {
    return { disponible: false, motivo: 'Cuenta de usuario inactiva' };
  }

  if (considerarDisponibilidad) {
    const reserva = colaborador.dedicacionReservada;
    const reservaValida =
      typeof reserva === 'number' && Number.isFinite(reserva) && reserva >= 0 && reserva <= 100;

    if (!reservaValida) {
      return { disponible: false, motivo: 'Dedicación no definida' };
    }

    const dedicacionDisponible = 100 - reserva;
    if (dedicacionDisponible <= 0) {
      return { disponible: false, motivo: 'Sin dedicación disponible' };
    }
  }

  return { disponible: true, motivo: null };
}

module.exports = {
  evaluarElegibilidad,
  verificarDisponibilidad,
  normalizarRequisitos,
  validarRequisito,
  cumpleNivelRequisito,
  NIVELES_VALIDOS,
};