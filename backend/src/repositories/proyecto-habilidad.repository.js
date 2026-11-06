const {
  dynamoDb,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('../../src/config/dynamodb.js');
const { tableProyectoHabilidad } = require('../../src/config/environment.js');
const { ErrorApp, CODIGOS } = require('../../src/utils/errors.js');
const cache = require('../../src/services/cache.service.js');

const CACHE_TTL_MS = 60000;
const NIVELES_VALIDOS = ['JUNIOR', 'MID', 'SENIOR'];

function claveRelacion(proyectoId, habilidadId) {
  return `proyecto-habilidad:${proyectoId}:${habilidadId}`;
}

function claveHabilidadesProyecto(proyectoId) {
  return `proyecto-habilidad:proyecto:${proyectoId}`;
}

async function asociarHabilidad(datos) {
  const { proyectoId, habilidadId, nivelMinimo, esObligatoria, peso, observaciones } = datos;

  if (!proyectoId || !habilidadId) {
    throw new ErrorApp('proyectoId y habilidadId son obligatorios', 400, CODIGOS.VALIDACION);
  }
  if (nivelMinimo === undefined) {
    throw new ErrorApp('nivelMinimo es obligatorio', 400, CODIGOS.VALIDACION);
  }
  validarNivelMinimo(nivelMinimo);
  if (esObligatoria === undefined || esObligatoria === null) {
    throw new ErrorApp('esObligatoria es obligatorio', 400, CODIGOS.VALIDACION);
  }

  const item = {
    proyectoId,
    habilidadId,
    nivelMinimo,
    esObligatoria: Boolean(esObligatoria),
    fechaCreacion: ahoraISO(),
    fechaActualizacion: ahoraISO(),
    ...(peso !== undefined && peso !== null && { peso }),
    ...(observaciones !== undefined && observaciones !== null && { observaciones }),
  };

  try {
    // La clave compuesta (proyectoId, habilidadId) es única: no se permiten
    // duplicados de la misma habilidad requerida en un proyecto.
    await dynamoDb.send(
      new PutCommand({
        TableName: tableProyectoHabilidad,
        Item: item,
        ConditionExpression: 'attribute_not_exists(habilidadId)',
      })
    );
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp(
        'Ya existe una relación entre este proyecto y la habilidad',
        409,
        CODIGOS.CONFLICTO
      );
    }
    throw e;
  }

  invalidarCachéRelacion(proyectoId, habilidadId);
  return item;
}

async function consultarHabilidadesProyecto(proyectoId) {
  const clave = claveHabilidadesProyecto(proyectoId);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const resultado = await dynamoDb.send(
    new QueryCommand({
      TableName: tableProyectoHabilidad,
      KeyConditionExpression: '#p = :p',
      ExpressionAttributeNames: { '#p': 'proyectoId' },
      ExpressionAttributeValues: { ':p': proyectoId },
    })
  );
  const items = resultado.Items || [];

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

async function modificarNivelMinimo(proyectoId, habilidadId, nivelMinimo) {
  validarNivelMinimo(nivelMinimo);
  return actualizarCampo(proyectoId, habilidadId, { nivelMinimo });
}

async function cambiarObligatoria(proyectoId, habilidadId, esObligatoria) {
  return actualizarCampo(proyectoId, habilidadId, { esObligatoria: Boolean(esObligatoria) });
}

async function actualizarPeso(proyectoId, habilidadId, peso) {
  if (typeof peso !== 'number' || !Number.isFinite(peso)) {
    throw new ErrorApp('El peso debe ser un número', 400, CODIGOS.VALIDACION);
  }
  return actualizarCampo(proyectoId, habilidadId, { peso });
}

async function actualizarCampo(proyectoId, habilidadId, cambios) {
  const sets = [];
  const nombresAtributos = {};
  const valoresAtributos = {};

  Object.entries(cambios).forEach(([campo, valor]) => {
    nombresAtributos[`#${campo}`] = campo;
    valoresAtributos[`:${campo}`] = valor;
    sets.push(`#${campo} = :${campo}`);
  });

  nombresAtributos['#fechaActualizacion'] = 'fechaActualizacion';
  valoresAtributos[':fechaActualizacion'] = ahoraISO();
  sets.push('#fechaActualizacion = :fechaActualizacion');

  try {
    const resultado = await dynamoDb.send(
      new UpdateCommand({
        TableName: tableProyectoHabilidad,
        Key: { proyectoId, habilidadId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: nombresAtributos,
        ExpressionAttributeValues: valoresAtributos,
        ConditionExpression: 'attribute_exists(proyectoId) AND attribute_exists(habilidadId)',
        ReturnValues: 'ALL_NEW',
      })
    );
    if (!resultado.Attributes) {
      throw new ErrorApp('Relación proyecto-habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
    }
    invalidarCachéRelacion(proyectoId, habilidadId);
    return resultado.Attributes;
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('Relación proyecto-habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
    }
    throw e;
  }
}

async function eliminarRelacion(proyectoId, habilidadId) {
  try {
    await dynamoDb.send(
      new DeleteCommand({
        TableName: tableProyectoHabilidad,
        Key: { proyectoId, habilidadId },
        ConditionExpression: 'attribute_exists(proyectoId) AND attribute_exists(habilidadId)',
      })
    );
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      throw new ErrorApp('Relación proyecto-habilidad no encontrada', 404, CODIGOS.NO_ENCONTRADO);
    }
    throw e;
  }

  invalidarCachéRelacion(proyectoId, habilidadId);
  return { proyectoId, habilidadId, eliminada: true };
}

async function consultarProyectosPorHabilidad(habilidadId) {
  const clave = claveProyectosHabilidad(habilidadId);
  const enCache = cache.obtener(clave);
  if (enCache !== undefined) return enCache;

  const resultado = await dynamoDb.send(
    new QueryCommand({
      TableName: tableProyectoHabilidad,
      IndexName: 'GSI1',
      KeyConditionExpression: '#h = :h',
      ExpressionAttributeNames: { '#h': 'habilidadId' },
      ExpressionAttributeValues: { ':h': habilidadId },
    })
  );
  const items = resultado.Items || [];

  cache.guardar(clave, items, CACHE_TTL_MS);
  return items;
}

module.exports = {
  asociarHabilidad,
  consultarHabilidadesProyecto,
  modificarNivelMinimo,
  cambiarObligatoria,
  actualizarPeso,
  eliminarRelacion,
  consultarProyectosPorHabilidad,
  validarNivelMinimo,
  NIVELES_VALIDOS,
};

function claveProyectosHabilidad(habilidadId) {
  return `proyecto-habilidad:habilidad:${habilidadId}`;
}

function invalidarCachéRelacion(proyectoId, habilidadId) {
  cache.eliminar(claveRelacion(proyectoId, habilidadId));
  cache.eliminar(claveHabilidadesProyecto(proyectoId));
  cache.eliminar(claveProyectosHabilidad(habilidadId));
  cache.eliminarPorPrefijo('proyecto-habilidad:');
}

function validarNivelMinimo(nivelMinimo) {
  if (!NIVELES_VALIDOS.includes(nivelMinimo)) {
    throw new ErrorApp(
      `Nivel mínimo inválido. Valores permitidos: ${NIVELES_VALIDOS.join(', ')}`,
      400,
      CODIGOS.VALIDACION
    );
  }
}

function ahoraISO() {
  return new Date().toISOString();
}