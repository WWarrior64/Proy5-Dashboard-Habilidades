#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * medirRendimiento.js - Medición de la estrategia de caché
 * ========================================================================
 *
 * Compara, en condiciones equivalentes y SIN credenciales de AWS:
 *   * Lecturas sin caché (cold / cache miss) vs. con caché (warm / cache hit)
 *     para catálogos (cargos/habilidades) y métricas de dashboard.
 *   * Tiempos de respuesta, conteo de operaciones simuladas de DynamoDB,
 *     consultas repetidas e invalidación de caché.
 *
 * Los bloqueos marcados como "SIMULACIÓN LOCAL" no tocan DynamoDB real ni
 * requieren credenciales. Al final se incluye el comportamiento esperado en
 * AWS Lambda (cold start, warm start, por instancia, sin distribución).
 *
 * Uso:
 *   node backend/scripts/medirRendimiento.js
 *
 * El módulo también se puede importar (expone `ejecutarTodo` y las mediciones
 * individuales) para reutilizarlo en pruebas unitarias.
 */

const cache = require('../src/services/cache.service.js');

// ---------------------------------------------------------------------------
// Simulador de DynamoDB (sin credenciales, sin red, sin AWS)
// ---------------------------------------------------------------------------
const operacionesDynamoDB = { count: 0 };

function resetOperaciones() {
  operacionesDynamoDB.count = 0;
}

function obtenerOperaciones() {
  return operacionesDynamoDB.count;
}

/**
 * Simula una lectura de DynamoDB con un coste fijo.
 * @param {string} nombre - Nombre de la operación (solo reporte)
 * @param {number} [costoMs=1] - Coste simulado en milisegundos
 * @returns {Promise<Object>}
 */
async function consultaDynamoDB(nombre, costoMs = 1) {
  operacionesDynamoDB.count += 1;
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, costoMs)));
  return { items: [], lastKey: null };
}

function msDesde(inicioHrTime) {
  return Number(process.hrtime.bigint() - inicioHrTime) / 1_000_000;
}

const REPETICIONES = 20;
const FILTROS_CATALOGO = { estado: 'ACTIVO', limit: 10 };
const CLAVE_CATALOGO = cache.construirClave(
  'cargos',
  'list',
  FILTROS_CATALOGO.estado,
  String(FILTROS_CATALOGO.limit),
  ''
);

// ---------------------------------------------------------------------------
// Medición 1: catálogo (cargos) - sin caché vs con caché
// ---------------------------------------------------------------------------
async function medirCatalogo(parametros = {}) {
  const repeticiones = parametros.repeticiones || REPETICIONES;
  const reporte = {
    nombre: 'Catálogo de cargos (listar con filtros y paginación)',
    repeticiones,
  };

  // --- Cold: sin caché, cada consulta llega a DynamoDB ---
  resetOperaciones();
  cache.limpiar();
  const inicioCold = process.hrtime.bigint();
  for (let i = 0; i < repeticiones; i += 1) {
    await consultaDynamoDB('cargos:list');
  }
  reporte.sinCache = {
    operacionesDynamoDB: obtenerOperaciones(),
    ms: msDesde(inicioCold),
  };

  // --- Warm: con caché, primera consulta es miss y las siguientes son hits ---
  resetOperaciones();
  cache.limpiar();
  const inicioWarmup = process.hrtime.bigint();
  const entradaPrevia = cache.obtener(CLAVE_CATALOGO);
  if (entradaPrevia === undefined) {
    await consultaDynamoDB('cargos:list');
    cache.guardar(CLAVE_CATALOGO, { items: [], lastKey: null }, 60_000);
  }
  reporte.primeraConsultaConCache = {
    operacionesDynamoDB: obtenerOperaciones(),
    ms: msDesde(inicioWarmup),
  };

  resetOperaciones();
  const inicioWarm = process.hrtime.bigint();
  let hits = 0;
  for (let i = 0; i < repeticiones; i += 1) {
    if (cache.obtener(CLAVE_CATALOGO) !== undefined) {hits += 1;}
  }
  reporte.conCache = {
    operacionesDynamoDB: obtenerOperaciones(),
    ms: msDesde(inicioWarm),
    hits,
  };

  reporte.operacionesAhorradas =
    reporte.sinCache.operacionesDynamoDB - reporte.conCache.operacionesDynamoDB;
  return reporte;
}

// ---------------------------------------------------------------------------
// Medición 2: dashboard (6 métricas) - sin caché vs con caché
// ---------------------------------------------------------------------------
const METRICAS_DASHBOARD = [
  { clave: cache.construirClave('dashboard', 'colaboradores', 'activos'), nombre: 'colaboradoresActivos' },
  { clave: cache.construirClave('dashboard', 'proyectos', 'por-estado'), nombre: 'proyectosPorEstado' },
  { clave: cache.construirClave('dashboard', 'asignaciones', 'activas'), nombre: 'asignacionesActivas' },
  { clave: cache.construirClave('dashboard', 'habilidades', 'distribucion'), nombre: 'distribucionHabilidades' },
  { clave: cache.construirClave('dashboard', 'postulaciones', 'por-estado'), nombre: 'postulacionesPorEstado' },
  { clave: cache.construirClave('dashboard', 'actividad', '7', '20'), nombre: 'actividadReciente' },
];

async function medirDashboard() {
  const reporte = { nombre: 'Dashboard resumen (6 métricas)', repeticiones: 1 };

  resetOperaciones();
  cache.limpiar();
  const inicioCold = process.hrtime.bigint();
  for (const metrica of METRICAS_DASHBOARD) {
    await consultaDynamoDB(metrica.nombre);
  }
  reporte.sinCache = {
    operacionesDynamoDB: obtenerOperaciones(),
    ms: msDesde(inicioCold),
  };

  resetOperaciones();
  cache.limpiar();
  const inicioWarmup = process.hrtime.bigint();
  for (const metrica of METRICAS_DASHBOARD) {
    const entrada = cache.obtener(metrica.clave);
    if (entrada === undefined) {
      await consultaDynamoDB(metrica.nombre);
      cache.guardar(metrica.clave, { valor: metrica.nombre }, 30_000);
    }
  }
  reporte.primeraConsultaConCache = {
    operacionesDynamoDB: obtenerOperaciones(),
    ms: msDesde(inicioWarmup),
  };

  resetOperaciones();
  const inicioWarm = process.hrtime.bigint();
  let hits = 0;
  for (const metrica of METRICAS_DASHBOARD) {
    if (cache.obtener(metrica.clave) !== undefined) {hits += 1;}
  }
  reporte.conCache = {
    operacionesDynamoDB: obtenerOperaciones(),
    ms: msDesde(inicioWarm),
    hits,
  };

  reporte.operacionesAhorradas =
    reporte.sinCache.operacionesDynamoDB - reporte.conCache.operacionesDynamoDB;
  return reporte;
}

// ---------------------------------------------------------------------------
// Medición 3: invalidación tras escritura (dato actualizado inmediatamente)
// ---------------------------------------------------------------------------
async function medirInvalidacion() {
  const reporte = { nombre: 'Invalidación inmediata tras escritura' };

  cache.limpiar();
  // Estado antes de escribir: caché cálida (hit)
  await consultaDynamoDB('cargos:list');
  cache.guardar(CLAVE_CATALOGO, { version: 1, items: [] }, 60_000);
  const antes = cache.obtener(CLAVE_CATALOGO);
  reporte.antesDeEscribir = {
    golpeaCaché: antes !== undefined,
    valor: antes && antes.version,
  };

  // Escritura: invalida prefijos de caché
  cache.eliminarPorPrefijo('cargos:list:');
  const despues = cache.obtener(CLAVE_CATALOGO);
  reporte.despuesDeEscribir = {
    golpeaCaché: despues !== undefined,
    valor: despues && despues.version,
    invalido: despues === undefined,
  };

  // Nueva lectura: miss → DynamoDB → dato fresco
  resetOperaciones();
  const inicioFresco = process.hrtime.bigint();
  let lecturaFresca = cache.obtener(CLAVE_CATALOGO);
  if (lecturaFresca === undefined) {
    await consultaDynamoDB('cargos:list');
    lecturaFresca = { version: 2, items: [] };
    cache.guardar(CLAVE_CATALOGO, lecturaFresca, 60_000);
  }
  reporte.lecturaTrasInvalidacion = {
    operacionesDynamoDB: obtenerOperaciones(),
    ms: msDesde(inicioFresco),
    valor: lecturaFresca && lecturaFresca.version,
    datosActualizados: (lecturaFresca && lecturaFresca.version) === 2,
  };
  return reporte;
}

// ---------------------------------------------------------------------------
// Medición 4: capacidad máxima y expulsión LRU
// ---------------------------------------------------------------------------
async function medirCapacidad() {
  const reporte = { nombre: 'Capacidad máxima y expulsión LRU' };
  const estadisticasAntes = cache.obtenerEstadisticas();

  // Llena la caché hasta superar la capacidad máxima (default 500).
  const entradaVieja = cache.construirClave('capacidad', 'antigua');
  cache.guardar(entradaVieja, { version: 1 }, 60_000);
  for (let i = 0; i < 520; i += 1) {
    cache.guardar(cache.construirClave('capacidad', String(i)), { i }, 60_000);
  }

  const estadisticasDespues = cache.obtenerEstadisticas();
  const aunViveLaAntigua = cache.obtener(entradaVieja) !== undefined;

  reporte.capacidadMaxima = estadisticasDespues.capacidadMaxima;
  reporte.entradasEvictadas = estadisticasDespues.entradasEvictadas - estadisticasAntes.entradasEvictadas;
  reporte.expulsoEntradaAntigua = !aunViveLaAntigua;
  reporte.entradasTotales = estadisticasDespues.entradasTotales;
  return reporte;
}

// ---------------------------------------------------------------------------
// Medición 5: expiración automática por TTL
// ---------------------------------------------------------------------------
async function medirExpiracion() {
  const reporte = { nombre: 'Expiración automática por TTL' };
  const clave = cache.construirClave('ttl', 'prueba');

  cache.limpiar();
  cache.guardar(clave, { valor: 'fresco' }, 60); // 60 ms de TTL
  reporte.despuesDeGuardar = cache.obtener(clave) !== undefined;

  await new Promise((resolve) => setTimeout(resolve, 80));
  const entrada = cache.obtener(clave);
  reporte.despuesDeExpiracion = {
    golpeaCaché: entrada !== undefined,
    expirada: entrada === undefined,
  };
  const stats = cache.obtenerEstadisticas();
  reporte.entradasExpiradas = stats.entradasExpiradas;
  reporte.expiracionesLimpieza = stats.expiracionesLimpieza;
  return reporte;
}

// ---------------------------------------------------------------------------
// Ejecutar todo y generar reporte
// ---------------------------------------------------------------------------
async function ejecutarTodo() {
  const catalogo = await medirCatalogo();
  const dashboard = await medirDashboard();
  const invalido = await medirInvalidacion();
  const capacidad = await medirCapacidad();
  const expiracion = await medirExpiracion();

  return {
    fecha: new Date().toISOString(),
    entorno: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'AWS Lambda' : 'local (simulación)',
    catalogo,
    dashboard,
    invalidacion: invalido,
    capacidad,
    expiracion,
  };
}

function imprimirReporte(reporte) {
  const linea = '============================================================';
  console.log(linea);
  console.log('REPORTE DE RENDIMIENTO DE CACHÉ — Dashboard de Habilidades');
  console.log(`Fecha: ${reporte.fecha} | Entorno: ${reporte.entorno}`);
  console.log(linea);

  function seccion(titulo, datos) {
    console.log(`\n## ${titulo}`);
    for (const [clave, valor] of Object.entries(datos)) {
      if (typeof valor === 'object') {
        console.log(`  ${clave}:`);
        for (const [sub, subValor] of Object.entries(valor)) {
          console.log(`    - ${sub}: ${subValor}`);
        }
      } else {
        console.log(`  ${clave}: ${valor}`);
      }
    }
  }

  seccion('1. Catálogo de cargos (consultas repetidas)', {
    'Sin caché (cold / miss)': `${reporte.catalogo.sinCache.operacionesDynamoDB} lecturas DynamoDB, ${reporte.catalogo.sinCache.ms.toFixed(2)} ms`,
    'Con caché (warm / hit)': `${reporte.catalogo.conCache.operacionesDynamoDB} lectura DynamoDB, ${reporte.catalogo.conCache.ms.toFixed(2)} ms, ${reporte.catalogo.conCache.hits} hits`,
    'Primera consulta con caché': `${reporte.catalogo.primeraConsultaConCache.operacionesDynamoDB} lectura DynamoDB`,
    'Operaciones ahorradas': `${reporte.catalogo.operacionesAhorradas} de ${reporte.catalogo.repeticiones}`,
  });

  seccion('2. Dashboard resumen (6 métricas)', {
    'Sin caché (cold / miss)': `${reporte.dashboard.sinCache.operacionesDynamoDB} lecturas DynamoDB, ${reporte.dashboard.sinCache.ms.toFixed(2)} ms`,
    'Con caché (warm / hit)': `${reporte.dashboard.conCache.operacionesDynamoDB} lecturas DynamoDB, ${reporte.dashboard.conCache.ms.toFixed(2)} ms, ${reporte.dashboard.conCache.hits} hits`,
    'Primera consulta con caché': `${reporte.dashboard.primeraConsultaConCache.operacionesDynamoDB} lecturas DynamoDB`,
    'Operaciones ahorradas': `${reporte.dashboard.operacionesAhorradas} de ${reporte.dashboard.sinCache.operacionesDynamoDB}`,
  });

  seccion('3. Invalidación tras escritura (dato actualizado)', {
    'Antes de escribir (golpea caché)': reporte.invalidacion.antesDeEscribir.golpeaCaché,
    'Después de escribir (caché invalidada)': `${reporte.invalidacion.despuesDeEscribir.invalido ? 'SÍ' : 'NO'}`,
    'Lectura tras invalidación (DynamoDB)': `${reporte.invalidacion.lecturaTrasInvalidacion.operacionesDynamoDB} lectura`,
    'Dato actualizado obtenido': reporte.invalidacion.lecturaTrasInvalidacion.datosActualizados ? 'SÍ' : 'NO',
  });

  seccion('4. Capacidad máxima y expulsión LRU', {
    'Capacidad máxima configurada': reporte.capacidad.capacidadMaxima,
    'Entradas expulsadas (LRU)': reporte.capacidad.entradasEvictadas,
    'La más antigua fue expulsada': reporte.capacidad.expulsoEntradaAntigua ? 'SÍ' : 'NO',
    'Entradas totales en caché': reporte.capacidad.entradasTotales,
  });

  seccion('5. Expiración automática por TTL', {
    'Justo después de guardar': reporte.expiracion.despuesDeGuardar ? 'HIT' : 'MISS',
    'Después del TTL (80 ms > 60 ms)': reporte.expiracion.despuesDeExpiracion.expirada ? 'EXPIRADA (MISS)' : 'HIT',
    'Entradas expiradas detectadas': reporte.expiracion.entradasExpiradas,
    'Limpieza de expirados ejecutada': reporte.expiracion.expiracionesLimpieza > 0,
  });

  console.log(`\n${linea}`);
  console.log('COMPORTAMIENTO ESPERADO EN AWS Lambda (vs medición local)');
  console.log(linea);
  console.log('  - Cold start: la instancia Lambda inicia con la caché vacía, por lo que la');
  console.log('    primera petición equivale a "sin caché" (mínimo 1 lectura DynamoDB).');
  console.log('  - Warm start: solicitudes repetidas en la MISMA instancia usan la caché');
  console.log('    en memoria (hit) → menos lecturas DynamoDB y menor latencia que local.');
  console.log('  - No es una caché distribuida: otras instancias Lambda no comparten esta');
  console.log('    caché ni la invalidan al escribir. Se mitiga con TTL cortos (dashboard:');
  console.log('    30 segundos y catálogos: 60 segundos) e invalidación local tras cada');
  console.log('    escritura.');
  console.log('  - Los datos críticos (permisos, dedicación reservada, estados de');
  console.log('    usuarios/colaboradores, validaciones de duplicidad transaccional) NO se');
  console.log('    cachean en ningún caso.');
  console.log('  - La capacidad máxima con LRU evita desbordar la memoria de la instancia.');
  console.log(linea);
  console.log('Fin del reporte.');
  console.log('');
}

if (require.main === module) {
  ejecutarTodo()
    .then((reporte) => {
      imprimirReporte(reporte);
    })
    .catch((error) => {
      console.error('Error ejecutando mediciones:', error);
      process.exit(1);
    });
}

module.exports = {
  ejecutarTodo,
  medirCatalogo,
  medirDashboard,
  medirInvalidacion,
  medirCapacidad,
  medirExpiracion,
  consultaDynamoDB,
  resetOperaciones,
  obtenerOperaciones,
};