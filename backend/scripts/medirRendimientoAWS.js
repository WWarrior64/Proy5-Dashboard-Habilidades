#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Mediciones reales y de solo lectura contra API Gateway.
 *
 * Uso: definir API_BASE_URL e API_ID_TOKEN en el entorno (no en Git);
 * opcionalmente PERF_HABILIDADES=h1,h2 y PERF_REPETICIONES=6.
 *   node backend/scripts/medirRendimientoAWS.js
 *
 * El benchmark no crea ni modifica registros. Mide latencias HTTP efectivas
 * (incluye red, API Gateway, Lambda y DynamoDB); no mide RCU/WCU directamente.
 * Los aciertos de caché son locales a la instancia Lambda y por eso no siempre
 * aparecen en solicitudes consecutivas. Para RCU y facturación consultar CloudWatch.
 */
const { performance } = require('node:perf_hooks');

function percentil(ordenados, fraccion) {
  if (!ordenados.length) return 0;
  return ordenados[Math.min(ordenados.length - 1, Math.ceil(ordenados.length * fraccion) - 1)];
}

function resumirTiempos(tiempos) {
  const ordenados = [...tiempos].sort((a, b) => a - b);
  const promedio = ordenados.reduce((acum, valor) => acum + valor, 0) / (ordenados.length || 1);
  return {
    solicitudes: ordenados.length,
    promedioMs: Number(promedio.toFixed(2)),
    p50Ms: Number(percentil(ordenados, 0.5).toFixed(2)),
    p95Ms: Number(percentil(ordenados, 0.95).toFixed(2)),
    minimoMs: Number((ordenados[0] || 0).toFixed(2)),
    maximoMs: Number((ordenados.at(-1) || 0).toFixed(2)),
  };
}

async function medirRuta({ nombre, url, token, repeticiones = 6, fetchImpl = fetch }) {
  if (!token) throw new Error('Se requiere API_ID_TOKEN en el entorno');
  if (!Number.isInteger(repeticiones) || repeticiones < 2 || repeticiones > 30) {
    throw new Error('PERF_REPETICIONES debe estar entre 2 y 30');
  }

  const tiempos = [];
  const metadatosCache = [];
  for (let i = 0; i < repeticiones; i += 1) {
    const inicio = performance.now();
    const respuesta = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const duracion = performance.now() - inicio;
    if (!respuesta.ok) throw new Error(`${nombre}: el servidor respondió HTTP ${respuesta.status}`);
    const cuerpo = await respuesta.json();
    if (cuerpo.success !== true) throw new Error(`${nombre}: la respuesta no indica éxito`);
    tiempos.push(duracion);
    metadatosCache.push(cuerpo.datos?.metadatos?.cache ?? null);
  }

  return {
    nombre,
    ruta: new URL(url).pathname,
    primeraSolicitudMs: Number(tiempos[0].toFixed(2)),
    solicitudesSiguientes: resumirTiempos(tiempos.slice(1)),
    total: resumirTiempos(tiempos),
    cache: {
      aciertosConfirmados: metadatosCache.filter(m => m?.desdeCache === true).length,
      lecturasConfirmadas: metadatosCache.filter(m => m?.desdeCache === false).length,
      respuestasSinMetadatos: metadatosCache.filter(m => m === null).length,
    },
  };
}

function construirRutas(baseUrl, habilidades) {
  const base = baseUrl.replace(/\/$/, '');
  const rutas = [
    { nombre: 'Dashboard general', url: `${base}/dashboard/resumen` },
    { nombre: 'Distribución de habilidades', url: `${base}/dashboard/habilidades` },
    { nombre: 'Catálogo de cargos', url: `${base}/cargos?limit=25` },
    { nombre: 'Catálogo de habilidades', url: `${base}/habilidades?limit=25` },
  ];
  if (habilidades.length) {
    rutas.push({
      nombre: 'Búsqueda por múltiples habilidades',
      url: `${base}/busqueda/colaboradores?habilidades=${encodeURIComponent(habilidades.join(','))}&limit=20`,
    });
  }
  return rutas;
}

async function ejecutarMediciones({
  baseUrl = process.env.API_BASE_URL,
  token = process.env.API_ID_TOKEN,
  habilidades = String(process.env.PERF_HABILIDADES || '').split(',').map(x => x.trim()).filter(Boolean),
  repeticiones = Number(process.env.PERF_REPETICIONES || 6),
  fetchImpl = fetch,
} = {}) {
  if (!baseUrl || !token) {
    throw new Error('Configure API_BASE_URL (incluye /api/v1) y API_ID_TOKEN antes de medir');
  }
  const urlBase = new URL(baseUrl);
  if (urlBase.protocol !== 'https:' &&
    !(urlBase.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(urlBase.hostname))) {
    throw new Error('Las mediciones remotas requieren HTTPS; HTTP solo se acepta en localhost');
  }
  if (!urlBase.pathname.endsWith('/api/v1')) {
    throw new Error('API_BASE_URL debe finalizar en /api/v1');
  }
  const resultados = [];
  for (const ruta of construirRutas(baseUrl, habilidades)) {
    resultados.push(await medirRuta({ ...ruta, token, repeticiones, fetchImpl }));
  }
  return {
    fecha: new Date().toISOString(),
    tipo: 'medición HTTP real (no simulación)',
    entorno: urlBase.host,
    repeticiones,
    nota: 'Las instancias Lambda no comparten caché. Los tiempos incluyen red y servicios AWS; verificar RCU/WCU en CloudWatch.',
    resultados,
  };
}

if (require.main === module) {
  ejecutarMediciones()
    .then(reporte => console.log(JSON.stringify(reporte, null, 2)))
    .catch(err => {
      console.error('No se completó la medición:', err.message);
      process.exitCode = 1;
    });
}

module.exports = { medirRuta, construirRutas, resumirTiempos, ejecutarMediciones };
