const { exito, error } = require('../../utils/responses.js');
const { ErrorApp, CODIGOS } = require('../../utils/errors.js');
const dashboardRepo = require('../../repositories/dashboard.repository.js');

function responderError(e) {
  if (e instanceof ErrorApp) return error(e.message, e.codigo, e.codigoError);
  return error('Error interno del servidor', 500, CODIGOS.INTERNO);
}

function obtenerNumerico(query, nombre, valorPorDefecto) {
  const raw = query && query[nombre];
  if (raw === undefined || raw === '') return valorPorDefecto;
  const valor = Number(raw);
  return Number.isFinite(valor) ? valor : valorPorDefecto;
}

async function obtenerColaboradoresActivos(event, context) {
  try {
    const total = await dashboardRepo.contarColaboradoresActivos();
    return exito({ total });
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerProyectosPorEstado(event, context) {
  try {
    const conteo = await dashboardRepo.contarProyectosPorEstado();
    return exito(conteo);
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerAsignacionesActivas(event, context) {
  try {
    const total = await dashboardRepo.contarAsignacionesActivas();
    return exito({ total });
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerDistribucionHabilidades(event, context) {
  try {
    const distribucion = await dashboardRepo.obtenerDistribucionHabilidades();
    return exito({ distribucion });
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerPostulacionesPorEstado(event, context) {
  try {
    const conteo = await dashboardRepo.obtenerPostulacionesPorEstado();
    return exito(conteo);
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerActividadReciente(event, context) {
  try {
    const query = event.queryStringParameters || {};
    const eventos = await dashboardRepo.obtenerActividadReciente({
      dias: obtenerNumerico(query, 'dias', 7),
      limite: obtenerNumerico(query, 'limite', 50),
    });
    return exito({ total: eventos.length, eventos });
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerResumenDashboard(event, context) {
  try {
    const [
      colaboradoresActivos,
      proyectosPorEstado,
      asignacionesActivas,
      distribucionHabilidades,
      postulacionesPorEstado,
      actividadReciente,
    ] = await Promise.all([
      dashboardRepo.contarColaboradoresActivos(),
      dashboardRepo.contarProyectosPorEstado(),
      dashboardRepo.contarAsignacionesActivas(),
      dashboardRepo.obtenerDistribucionHabilidades(),
      dashboardRepo.obtenerPostulacionesPorEstado(),
      dashboardRepo.obtenerActividadReciente({ dias: 7, limite: 20 }),
    ]);
    return exito({
      colaboradoresActivos,
      proyectosPorEstado,
      asignacionesActivas,
      distribucionHabilidades,
      postulacionesPorEstado,
      actividadReciente,
    });
  } catch (e) {
    return responderError(e);
  }
}

const { crearDespachador } = require('../../utils/lambda-dispatcher');

const handler = crearDespachador({
  'GET /api/v1/dashboard/colaboradores': obtenerColaboradoresActivos,
  'GET /api/v1/dashboard/proyectos': obtenerProyectosPorEstado,
  'GET /api/v1/dashboard/asignaciones': obtenerAsignacionesActivas,
  'GET /api/v1/dashboard/habilidades': obtenerDistribucionHabilidades,
  'GET /api/v1/dashboard/postulaciones': obtenerPostulacionesPorEstado,
  'GET /api/v1/dashboard/actividad': obtenerActividadReciente,
  'GET /api/v1/dashboard/resumen': obtenerResumenDashboard,
});

module.exports = {
  obtenerColaboradoresActivos,
  obtenerProyectosPorEstado,
  obtenerAsignacionesActivas,
  obtenerDistribucionHabilidades,
  obtenerPostulacionesPorEstado,
  obtenerActividadReciente,
  obtenerResumenDashboard,
  handler,
};