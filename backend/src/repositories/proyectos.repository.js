const { v4: uuidv4 } = require('uuid');
const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} = require('../../src/config/dynamodb.js');
const { tableProyectos, tableUsuarios, tableAsignaciones, tableProyectoHabilidad } = require('../../src/config/environment.js');
const { ErrorApp, CODIGOS } = require('../../src/utils/errors.js');
const cache = require('../../src/services/cache.service.js');

const CACHE_TTL_MS = 60000;
const ESTADOS_VALIDOS = ['BORRADOR', 'ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO'];
const TRANSICIONES = Object.freeze({
  BORRADOR: ['ACTIVO', 'CANCELADO'],
  ACTIVO: ['PAUSADO', 'COMPLETADO', 'CANCELADO'],
  PAUSADO: ['ACTIVO', 'COMPLETADO', 'CANCELADO'],
  COMPLETADO: [],
  CANCELADO: [],
});

function validarTransicion(origen, destino) {
  validarEstado(destino);
  if (origen !== destino && !TRANSICIONES[origen]?.includes(destino)) {
    throw new ErrorApp(`No se permite cambiar un proyecto de ${origen} a ${destino}`, 409, CODIGOS.CONFLICTO);
  }
  if (['COMPLETADO', 'CANCELADO'].includes(origen)) {
    throw new ErrorApp('Un proyecto completado o cancelado no puede modificarse', 409, CODIGOS.CONFLICTO);
  }
}

async function consultarProyectoConsistente(proyectoId) {
  const respuesta = await dynamoDb.send(new GetCommand({
    TableName: tableProyectos, Key: { proyectoId }, ConsistentRead: true,
  }));
  if (!respuesta.Item) throw new ErrorApp('Proyecto no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  return respuesta.Item;
}

function ahoraISO() {
  return new Date().toISOString();
}

async function consultarTodasPaginas(parametros) {
  const items = [];
  let lastKey;
  do {
    const pagina = await dynamoDb.send(new QueryCommand({
      ...parametros,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    items.push(...(pagina.Items || []));
    lastKey = pagina.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

function claveProyecto(proyectoId) {
  return `proyecto:${proyectoId}`;
}

function claveListaProyectos(filtros = {}) {
  return `proyectos:list:${JSON.stringify({
    estado: filtros.estado ?? null,
    liderId: filtros.liderId ?? null,
    fecha: filtros.fecha ?? null,
  })}`;
}

function claveProyectosActivos() {
  return 'proyectos:activos';
}

/**
 * Invalida las entradas de caché afectadas por una escritura sobre un proyecto:
 * el proyecto en particular, el listado de activos y los listados filtrados.
 * @param {string} proyectoId
 */
function invalidarCachéProyecto(proyectoId) {
  cache.eliminar(claveProyecto(proyectoId));
  cache.eliminar(claveProyectosActivos());
  cache.eliminarPorPrefijo('proyectos:list:');
}

async function validarLider(liderId) {
  const resultado = await dynamoDb.send(
    new GetCommand({
      TableName: tableUsuarios,
      Key: { usuarioId: liderId },
    })
  );
  const usuario = resultado.Item;
  if (!usuario) {
    throw new ErrorApp('El líder especificado no existe', 404, CODIGOS.NO_ENCONTRADO);
  }
  if (usuario.rol !== 'LIDER_PROYECTO') {
    throw new ErrorApp('El líder debe tener el rol LIDER_PROYECTO', 400, CODIGOS.VALIDACION);
  }
  if (usuario.estado !== 'ACTIVO') {
    throw new ErrorApp('El líder no está activo', 400, CODIGOS.VALIDACION);
  }
  return usuario;
}

function validarEstado(estado) {
  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw new ErrorApp(
      `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`,
      400,
      CODIGOS.VALIDACION
    );
  }
}

async function verificarHabilidadesParaPublicar(proyectoId) {
  const respuesta = await dynamoDb.send(new QueryCommand({
    TableName: tableProyectoHabilidad,
    KeyConditionExpression: '#proyecto = :proyecto',
    ExpressionAttributeNames: { '#proyecto': 'proyectoId' },
    ExpressionAttributeValues: { ':proyecto': proyectoId },
    ConsistentRead: true,
    Limit: 1,
  }));
  if (!respuesta.Items?.length) {
    throw new ErrorApp('Selecciona al menos una habilidad requerida antes de publicar el proyecto',
      400, CODIGOS.VALIDACION);
  }
}

async function comprobarPrimeraPublicacion(proyectoId, estado) {
  if (estado !== 'ACTIVO') return false;
  await verificarHabilidadesParaPublicar(proyectoId);
  const resultado = await dynamoDb.send(new GetCommand({
    TableName: tableProyectos,
    Key: { proyectoId },
    ConsistentRead: true,
  }));
  if (!resultado.Item) {
    throw new ErrorApp('Proyecto no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  }
  return resultado.Item.estado === 'BORRADOR';
}

function validarTextoProyecto(valor, campo, maximo = 2000) {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) {
    throw new ErrorApp(`${campo} debe ser un texto no vacío de hasta ${maximo} caracteres`, 400, CODIGOS.VALIDACION);
  }
  return valor.trim();
}

function validarHorasProyecto(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    throw new ErrorApp('Las horas requeridas deben ser un número positivo', 400, CODIGOS.VALIDACION);
  }
}

function validarFechas(inicio, fin) {
  for (const valor of [inicio, fin]) {
    if (valor !== undefined && valor !== null &&
      (typeof valor !== 'string' || !Number.isFinite(Date.parse(valor)))) {
      throw new ErrorApp('Las fechas deben ser cadenas de fecha válidas', 400, CODIGOS.VALIDACION);
    }
  }
  if (inicio && fin && Date.parse(fin) < Date.parse(inicio)) {
    throw new ErrorApp('fechaFin no puede ser anterior a fechaInicio', 400, CODIGOS.VALIDACION);
  }
}

function itemBaseProyecto(proyectoId, datos, ahora) {
  const { estado, objetivo, fechaInicio, fechaFin, fechaPublicacion } = datos;
  return {
    proyectoId,
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    liderId: datos.liderId,
    horasRequeridas: datos.horasRequeridas,
    estado,
    asignacionesActivas: 0,
    requisitosRevision: 0,
    ...(estado === 'ACTIVO' && { fechaPublicacion: fechaPublicacion || ahora }),
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
    creadoPor: datos.creadoPor,
    ...(objetivo !== undefined && { objetivo }),
    ...(fechaInicio !== undefined && { fechaInicio }),
    ...(fechaFin !== undefined && { fechaFin }),
    // Claves de orden de los GSIs (GSI1: estado / fechaPublicacion#proyectoId;
    // GSI2: liderId / estado#fechaCreacion)
    fechaPublicacionKey: `${fechaPublicacion || ahora}#${proyectoId}`,
    estadoFechaKey: `${estado}#${ahora}`,
  };
}

async function crearProyecto(datos) {
  const {
    nombre,
    descripcion,
    liderId,
    horasRequeridas,
    creadoPor,
    proyectoId: proyectoIdEntrada,
  } = datos;

  if (!nombre || !descripcion || !liderId || horasRequeridas === undefined || !creadoPor) {
    throw new ErrorApp(
      'nombre, descripcion, liderId, horasRequeridas y creadoPor son obligatorios',
      400,
      CODIGOS.VALIDACION
    );
  }
  const nombreValido = validarTextoProyecto(nombre, 'nombre', 200);
  const descripcionValida = validarTextoProyecto(descripcion, 'descripcion');
  if (datos.objetivo !== undefined && datos.objetivo !== null) validarTextoProyecto(datos.objetivo, 'objetivo');
  validarHorasProyecto(horasRequeridas);

  const estado = datos.estado || 'BORRADOR';
  validarEstado(estado);
  if (estado !== 'BORRADOR') {
    throw new ErrorApp('Crea el proyecto como BORRADOR, registra sus habilidades requeridas y luego publícalo',
      400, CODIGOS.VALIDACION);
  }
  validarFechas(datos.fechaInicio, datos.fechaFin);
  if (datos.fechaPublicacion !== undefined) validarFechas(datos.fechaPublicacion);
  await validarLider(liderId);

  const proyectoId = proyectoIdEntrada || uuidv4();
  const ahora = ahoraISO();
  const item = itemBaseProyecto(proyectoId, {
    ...datos, nombre: nombreValido, descripcion: descripcionValida,
    ...(datos.objetivo != null && { objetivo: datos.objetivo.trim() }), estado,
  }, ahora);

  await dynamoDb.send(
    new PutCommand({
      TableName: tableProyectos,
      Item: item,
      ConditionExpression: 'attribute_not_exists(proyectoId)',
    })
  );

  invalidarCachéProyecto(proyectoId);
  return item;
}

async function obtenerProyecto(proyectoId) {
  const clave = claveProyecto(proyectoId);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const resultado = await dynamoDb.send(
    new GetCommand({
      TableName: tableProyectos,
      Key: { proyectoId },
    })
  );
  const proyecto = resultado.Item;
  if (!proyecto) {
    throw new ErrorApp('Proyecto no encontrado', 404, CODIGOS.NO_ENCONTRADO);
  }

  cache.guardar(clave, proyecto, CACHE_TTL_MS);
  return proyecto;
}

async function listarProyectos(filtros = {}) {
  const { estado, liderId, fecha } = filtros;
  const clave = claveListaProyectos(filtros);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  let items;
  const nombresAtributos = {};
  const valoresAtributos = {};

  if (liderId) {
    nombresAtributos['#lid'] = 'liderId';
    valoresAtributos[':lid'] = liderId;
    const condicionesFiltro = [];
    if (estado) {
      nombresAtributos['#est'] = 'estado';
      valoresAtributos[':est'] = estado;
      condicionesFiltro.push('#est = :est');
    }
    if (fecha) {
      nombresAtributos['#fp'] = 'fechaPublicacion';
      valoresAtributos[':fecha'] = fecha;
      condicionesFiltro.push('#fp >= :fecha');
    }
    const params = {
      TableName: tableProyectos,
      IndexName: 'GSI2',
      KeyConditionExpression: '#lid = :lid',
      ExpressionAttributeNames: nombresAtributos,
      ExpressionAttributeValues: valoresAtributos,
    };
    if (condicionesFiltro.length > 0) {
      params.FilterExpression = condicionesFiltro.join(' AND ');
    }
    items = await consultarTodasPaginas(params);
  } else if (estado) {
    nombresAtributos['#est'] = 'estado';
    valoresAtributos[':est'] = estado;
    const params = {
      TableName: tableProyectos,
      IndexName: 'GSI1',
      KeyConditionExpression: '#est = :est',
      ExpressionAttributeNames: nombresAtributos,
      ExpressionAttributeValues: valoresAtributos,
    };
    if (fecha) {
      nombresAtributos['#fp'] = 'fechaPublicacion';
      valoresAtributos[':fecha'] = fecha;
      params.FilterExpression = '#fp >= :fecha';
    }
    items = await consultarTodasPaginas(params);
  } else {
    // Listado general: consultar cada partición del GSI1 evita un Scan de proyectos.
    const paginas = await Promise.all(ESTADOS_VALIDOS.map(estadoActual => consultarTodasPaginas({
      TableName: tableProyectos,
      IndexName: 'GSI1',
      KeyConditionExpression: '#est = :est',
      ...(fecha && { FilterExpression: '#fp >= :fecha' }),
      ExpressionAttributeNames: {
        '#est': 'estado',
        ...(fecha && { '#fp': 'fechaPublicacion' }),
      },
      ExpressionAttributeValues: {
        ':est': estadoActual,
        ...(fecha && { ':fecha': fecha }),
      },
    })));
    items = paginas.flat();
  }

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

async function verificarSinAsignacionesActivas(proyectoId) {
  const resultado = await dynamoDb.send(new QueryCommand({
    TableName: tableAsignaciones,
    IndexName: 'GSI2',
    KeyConditionExpression: '#p = :p AND begins_with(#s, :activa)',
    ExpressionAttributeNames: { '#p': 'proyectoId', '#s': 'proyectoFechaKey' },
    ExpressionAttributeValues: { ':p': proyectoId, ':activa': 'ACTIVA#' },
    Limit: 1,
  }));
  if (resultado?.Items?.length) {
    throw new ErrorApp('Desvincule o finalice las asignaciones activas antes de cerrar el proyecto', 409, CODIGOS.CONFLICTO);
  }
}

async function actualizarProyecto(proyectoId, cambios) {
  const { nombre, descripcion, objetivo, liderId, horasRequeridas, fechaInicio, fechaFin, estado } = cambios;
  const actual = await consultarProyectoConsistente(proyectoId);
  if (estado !== undefined) validarTransicion(actual.estado, estado);
  else if (['COMPLETADO', 'CANCELADO'].includes(actual.estado)) {
    throw new ErrorApp('No se pueden modificar proyectos completados o cancelados', 409, CODIGOS.CONFLICTO);
  }
  const primeraPublicacion = estado === 'ACTIVO' && actual.estado === 'BORRADOR';
  if (estado === 'ACTIVO' && actual.estado !== 'ACTIVO') await verificarHabilidadesParaPublicar(proyectoId);
  validarFechas(fechaInicio ?? actual.fechaInicio, fechaFin ?? actual.fechaFin);
  const sets = [];
  const nombresAtributos = {};
  const valoresAtributos = {};
  const ahora = ahoraISO();

  if (nombre !== undefined) {
    nombresAtributos['#n'] = 'nombre';
    valoresAtributos[':n'] = validarTextoProyecto(nombre, 'nombre', 200);
    sets.push('#n = :n');
  }
  if (descripcion !== undefined) {
    nombresAtributos['#d'] = 'descripcion';
    valoresAtributos[':d'] = validarTextoProyecto(descripcion, 'descripcion');
    sets.push('#d = :d');
  }
  if (objetivo !== undefined) {
    nombresAtributos['#obj'] = 'objetivo';
    valoresAtributos[':obj'] = validarTextoProyecto(objetivo, 'objetivo');
    sets.push('#obj = :obj');
  }
  if (liderId !== undefined) {
    await validarLider(liderId);
    nombresAtributos['#lid'] = 'liderId';
    valoresAtributos[':lid'] = liderId;
    sets.push('#lid = :lid');
  }
  if (horasRequeridas !== undefined) {
    validarHorasProyecto(horasRequeridas);
    nombresAtributos['#hr'] = 'horasRequeridas';
    valoresAtributos[':hr'] = horasRequeridas;
    sets.push('#hr = :hr');
  }
  if (fechaInicio !== undefined) {
    nombresAtributos['#fi'] = 'fechaInicio';
    valoresAtributos[':fi'] = fechaInicio;
    sets.push('#fi = :fi');
  }
  if (fechaFin !== undefined) {
    nombresAtributos['#ff'] = 'fechaFin';
    valoresAtributos[':ff'] = fechaFin;
    sets.push('#ff = :ff');
  }
  if (estado !== undefined) {
    validarEstado(estado);
    if (['CANCELADO', 'COMPLETADO'].includes(estado)) await verificarSinAsignacionesActivas(proyectoId);
    nombresAtributos['#est'] = 'estado';
    valoresAtributos[':est'] = estado;
    sets.push('#est = :est');
    nombresAtributos['#s2'] = 'estadoFechaKey';
    valoresAtributos[':s2'] = `${estado}#${ahora}`;
    sets.push('#s2 = :s2');
    if (primeraPublicacion) {
      nombresAtributos['#fp'] = 'fechaPublicacion';
      nombresAtributos['#fpk'] = 'fechaPublicacionKey';
      valoresAtributos[':fp'] = ahora;
      valoresAtributos[':fpk'] = `${ahora}#${proyectoId}`;
      sets.push('#fp = :fp', '#fpk = :fpk');
    }
  }

  nombresAtributos['#ua'] = 'fechaActualizacion';
  nombresAtributos['#actual'] = 'estado';
  valoresAtributos[':estadoAnterior'] = actual.estado;
  nombresAtributos['#revision'] = 'requisitosRevision';
  valoresAtributos[':revisionAnterior'] = actual.requisitosRevision ?? 0;
  if (['CANCELADO', 'COMPLETADO'].includes(estado)) {
    nombresAtributos['#activas'] = 'asignacionesActivas';
    valoresAtributos[':cero'] = 0;
  }
  valoresAtributos[':ua'] = ahora;
  sets.push('#ua = :ua');

  if (sets.length <= 1) {
    throw new ErrorApp('No hay campos para actualizar', 400, CODIGOS.VALIDACION);
  }

  try {
    const resultado = await dynamoDb.send(new UpdateCommand({
      TableName: tableProyectos,
      Key: { proyectoId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: nombresAtributos,
      ExpressionAttributeValues: valoresAtributos,
      ConditionExpression: 'attribute_exists(proyectoId) AND #actual = :estadoAnterior AND (attribute_not_exists(#revision) OR #revision = :revisionAnterior)' +
        (['CANCELADO', 'COMPLETADO'].includes(estado) ? ' AND #activas = :cero' : ''),
      ReturnValues: 'ALL_NEW',
    }));
    if (!resultado.Attributes) {
      throw new ErrorApp('Proyecto no encontrado', 404, CODIGOS.NO_ENCONTRADO);
    }
    invalidarCachéProyecto(proyectoId);
    return resultado.Attributes;
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('El estado del proyecto cambió durante la operación; recargue antes de reintentar', 409, CODIGOS.CONFLICTO);
    }
    throw e;
  }
}

async function cambiarEstado(proyectoId, estado) {
  const actual = await consultarProyectoConsistente(proyectoId);
  validarTransicion(actual.estado, estado);
  const primeraPublicacion = estado === 'ACTIVO' && actual.estado === 'BORRADOR';
  if (estado === 'ACTIVO' && actual.estado !== 'ACTIVO') await verificarHabilidadesParaPublicar(proyectoId);
  if (['CANCELADO', 'COMPLETADO'].includes(estado)) await verificarSinAsignacionesActivas(proyectoId);
  const ahora = ahoraISO();
  const cierre = ['CANCELADO', 'COMPLETADO'].includes(estado);
  try {
    const resultado = await dynamoDb.send(new UpdateCommand({
      TableName: tableProyectos,
      Key: { proyectoId },
      UpdateExpression: `SET #est = :est, #s2 = :s2, #ua = :ua${primeraPublicacion ? ', #fp = :fp, #fpk = :fpk' : ''}`,
      ExpressionAttributeNames: {
        '#est': 'estado', '#s2': 'estadoFechaKey', '#ua': 'fechaActualizacion', '#revision': 'requisitosRevision',
        ...(cierre && { '#activas': 'asignacionesActivas' }),
        ...(primeraPublicacion && { '#fp': 'fechaPublicacion', '#fpk': 'fechaPublicacionKey' }),
      },
      ExpressionAttributeValues: {
        ':est': estado,
        ':estadoAnterior': actual.estado,
        ':revisionAnterior': actual.requisitosRevision ?? 0,
        ...(cierre && { ':cero': 0 }),
        ':s2': `${estado}#${ahora}`,
        ':ua': ahora,
        ...(primeraPublicacion && { ':fp': ahora, ':fpk': `${ahora}#${proyectoId}` }),
      },
      ConditionExpression: 'attribute_exists(proyectoId) AND #est = :estadoAnterior AND (attribute_not_exists(#revision) OR #revision = :revisionAnterior)' +
        (cierre ? ' AND #activas = :cero' : ''),
      ReturnValues: 'ALL_NEW',
    }));
    invalidarCachéProyecto(proyectoId);
    return resultado.Attributes;
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('El proyecto cambió de estado durante la operación', 409, CODIGOS.CONFLICTO);
    }
    throw e;
  }
}

async function cancelarProyecto(proyectoId) {
  // Cancelar es un cambio lógico de estado a CANCELADO; el ítem se conserva
  // para mantener el historial (no se elimina físicamente).
  return cambiarEstado(proyectoId, 'CANCELADO');
}

async function listarProyectosActivos() {
  const clave = claveProyectosActivos();
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const items = await consultarTodasPaginas({
      TableName: tableProyectos,
      IndexName: 'GSI1',
      KeyConditionExpression: '#est = :est',
      ExpressionAttributeNames: { '#est': 'estado' },
      ExpressionAttributeValues: { ':est': 'ACTIVO' },
  });

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

module.exports = {
  crearProyecto,
  obtenerProyecto,
  listarProyectos,
  actualizarProyecto,
  cambiarEstado,
  cancelarProyecto,
  listarProyectosActivos,
  validarLider,
  validarEstado,
  ESTADOS_VALIDOS,
  claveProyecto,
  claveListaProyectos,
  claveProyectosActivos,
  invalidarCachéProyecto,
};
