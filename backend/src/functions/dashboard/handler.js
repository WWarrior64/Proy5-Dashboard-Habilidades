const { exito, error } = require('../../utils/responses.js');
const { ErrorApp, CODIGOS } = require('../../utils/errors.js');
const dashboardRepo = require('../../repositories/dashboard.repository.js');
const cache = require('../../services/cache.service.js');

// TTL breve para métricas de dashboard (E02/E03). Los datos pueden
// actualizarse con demora; se comunica en los metadatos de la respuesta.
const ttlDashboardEnv = Number(process.env.CACHE_TTL_DASHBOARD_SECONDS);
const TTL_DASHBOARD_SEGUNDOS =
  Number.isFinite(ttlDashboardEnv) && ttlDashboardEnv > 0 ? ttlDashboardEnv : 30;
const TTL_DASHBOARD_MS = TTL_DASHBOARD_SEGUNDOS * 1000;

/**
 * Ejecuta una lectura de dashboard con caché de proceso por instancia (TTL breve).
 * @param {string} clave - Clave de caché (incluye parámetros de consulta)
 * @param {Function} fn - Función que consulta DynamoDB ante un cache miss
 * @returns {Promise<{ valor: any, desdeCache: boolean }>}
 */
async function obtenerConCaché(clave, fn) {
  const valorCacheado = cache.obtener(clave);
  if (valorCacheado !== undefined) {
    return { valor: valorCacheado, desdeCache: true };
  }
  const valor = await fn();
  cache.guardar(clave, valor, TTL_DASHBOARD_MS);
  return { valor, desdeCache: false };
}

/**
 * Metadatos de caché expuestos en la respuesta del endpoint (E03).
 * @param {boolean} desdeCache - Si la respuesta provino de caché
 * @param {'caché'|'dynamodb'|'parcial'} origen - Origen de los datos
 * @returns {Object}
 */
function metadatosCache(desdeCache, origen = desdeCache ? 'caché' : 'dynamodb') {
  return {
    cache: {
      desdeCache,
      origen,
      ttlSegundos: TTL_DASHBOARD_SEGUNDOS,
    },
    actualizadoEn: new Date().toISOString(),
  };
}

function responderError(e) {
  if (e instanceof ErrorApp) {return error(e.message, e.codigo, e.codigoError);}
  return error('Error interno del servidor', 500, CODIGOS.INTERNO);
}

function obtenerNumerico(query, nombre, valorPorDefecto, maximo) {
  const raw = query?.[nombre];
  if (raw === undefined || raw === '') {return valorPorDefecto;}
  const valor = Number(raw);
  if (!Number.isInteger(valor) || valor < 1 || valor > maximo) {
    throw new ErrorApp(`${nombre} debe ser un entero entre 1 y ${maximo}`, 400, CODIGOS.VALIDACION);
  }
  return valor;
}

async function obtenerColaboradoresActivos() {
  try {
    const { valor: total, desdeCache } = await obtenerConCaché(
      cache.construirClave('dashboard', 'colaboradores', 'activos'),
      () => dashboardRepo.contarColaboradoresActivos(),
    );
    return exito({ total, metadatos: metadatosCache(desdeCache) });
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerProyectosPorEstado() {
  try {
    const { valor: conteo, desdeCache } = await obtenerConCaché(
      cache.construirClave('dashboard', 'proyectos', 'por-estado'),
      () => dashboardRepo.contarProyectosPorEstado(),
    );
    return exito({ ...conteo, metadatos: metadatosCache(desdeCache) });
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerAsignacionesActivas() {
  try {
    const { valor: total, desdeCache } = await obtenerConCaché(
      cache.construirClave('dashboard', 'asignaciones', 'activas'),
      () => dashboardRepo.contarAsignacionesActivas(),
    );
    return exito({ total, metadatos: metadatosCache(desdeCache) });
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerDistribucionHabilidades(event) {
  try {
    const { valor: distribucion, desdeCache } = await obtenerConCaché(
      cache.construirClave('dashboard', 'habilidades', 'distribucion'),
      () => dashboardRepo.obtenerDistribucionHabilidades(),
    );
    return exito({ distribucion, metadatos: metadatosCache(desdeCache) });
  } catch (e) {
    // CloudWatch conserva la causa técnica; el cliente solo recibe el error genérico.
    // eslint-disable-next-line no-console
    console.error('dashboard/habilidades falló', {
      requestId: event.requestContext?.requestId,
      nombre: e.name,
      mensaje: e.message,
    });
    return responderError(e);
  }
}

async function obtenerPostulacionesPorEstado() {
  try {
    const { valor: conteo, desdeCache } = await obtenerConCaché(
      cache.construirClave('dashboard', 'postulaciones', 'por-estado'),
      () => dashboardRepo.obtenerPostulacionesPorEstado(),
    );
    return exito({ ...conteo, metadatos: metadatosCache(desdeCache) });
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerActividadReciente(event) {
  try {
    const query = event.queryStringParameters || {};
    const dias = obtenerNumerico(query, 'dias', 7, 365);
    const limite = obtenerNumerico(query, 'limite', 50, 100);
    const { valor: eventos, desdeCache } = await obtenerConCaché(
      cache.construirClave('dashboard', 'actividad', String(dias), String(limite)),
      () => dashboardRepo.obtenerActividadReciente({ dias, limite }),
    );
    return exito({ total: eventos.length, eventos, metadatos: metadatosCache(desdeCache) });
  } catch (e) {
    return responderError(e);
  }
}

async function obtenerResumenDashboard() {
  try {
    const [
      { valor: colaboradoresActivos, desdeCache: c1 },
      { valor: proyectosPorEstado, desdeCache: c2 },
      { valor: asignacionesActivas, desdeCache: c3 },
      { valor: distribucionHabilidades, desdeCache: c4 },
      { valor: postulacionesPorEstado, desdeCache: c5 },
      { valor: actividadReciente, desdeCache: c6 },
    ] = await Promise.all([
      obtenerConCaché(cache.construirClave('dashboard', 'colaboradores', 'activos'),
        () => dashboardRepo.contarColaboradoresActivos()),
      obtenerConCaché(cache.construirClave('dashboard', 'proyectos', 'por-estado'),
        () => dashboardRepo.contarProyectosPorEstado()),
      obtenerConCaché(cache.construirClave('dashboard', 'asignaciones', 'activas'),
        () => dashboardRepo.contarAsignacionesActivas()),
      obtenerConCaché(cache.construirClave('dashboard', 'habilidades', 'distribucion'),
        () => dashboardRepo.obtenerDistribucionHabilidades()),
      obtenerConCaché(cache.construirClave('dashboard', 'postulaciones', 'por-estado'),
        () => dashboardRepo.obtenerPostulacionesPorEstado()),
      obtenerConCaché(cache.construirClave('dashboard', 'actividad', '7', '20'),
        () => dashboardRepo.obtenerActividadReciente({ dias: 7, limite: 20 })),
    ]);
    const todosDesdeCache = [c1, c2, c3, c4, c5, c6].every((desdeCache) => desdeCache);
    const ningunoDesdeCache = [c1, c2, c3, c4, c5, c6].every((desdeCache) => !desdeCache);
    const origen = todosDesdeCache
      ? 'caché'
      : ningunoDesdeCache
        ? 'dynamodb'
        : 'parcial';
    return exito({
      colaboradoresActivos,
      proyectosPorEstado,
      asignacionesActivas,
      distribucionHabilidades,
      postulacionesPorEstado,
      actividadReciente,
      metadatos: metadatosCache(todosDesdeCache, origen),
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