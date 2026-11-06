const NIVELES_VALIDOS = ['JUNIOR', 'MID', 'SENIOR'];
const NIVELES_VALOR = { JUNIOR: 1, MID: 2, SENIOR: 3 };

/**
 * Calcula el porcentaje de coincidencia de un colaborador frente a habilidades requeridas.
 * @param {Object} colaborador - Datos del colaborador con habilidadesCoincidentes y totalRequeridas.
 * @returns {number} Porcentaje entre 0 y 100.
 */
function calcularPuntuacion(colaborador) {
  const coincidencias = Array.isArray(colaborador.habilidadesCoincidentes)
    ? colaborador.habilidadesCoincidentes.length
    : 0;
  const total = colaborador.totalRequeridas || 1;
  return Math.round((coincidencias / total) * 100);
}

/**
 * Verifica si el nivel de un colaborador cumple con el nivel mínimo requerido.
 * @param {string} nivelPoseido - Nivel del colaborador (JUNIOR, MID, SENIOR).
 * @param {string} nivelRequerido - Nivel mínimo requerido.
 * @returns {boolean}
 */
function cumpleNivelMinimo(nivelPoseido, nivelRequerido) {
  const valorPoseido = NIVELES_VALOR[nivelPoseido] || 0;
  const valorRequerido = NIVELES_VALOR[nivelRequerido] || 0;
  return valorPoseido >= valorRequerido;
}

/**
 * Filtra candidatos por estado y disponibilidad.
 * @param {Array} candidatos - Lista de candidatos.
 * @param {boolean} soloActivos - Si se deben excluir inactivos.
 * @returns {Array} Candidatos filtrados.
 */
function filtrarPorDisponibilidad(candidatos, soloActivos = true) {
  if (!Array.isArray(candidatos)) return [];
  if (!soloActivos) return candidatos;
  return candidatos.filter((c) => c.estado === 'ACTIVO');
}

/**
 * Ordena candidatos por puntuación descendente.
 * @param {Array} candidatos
 * @returns {Array}
 */
function ordenarPorPuntuacion(candidatos) {
  if (!Array.isArray(candidatos)) return [];
  return [...candidatos].sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0));
}

/**
 * Filtra elementos por habilidades de forma eficiente usando Set para búsquedas O(1).
 * @param {Array} items - Lista de elementos a filtrar.
 * @param {Array} habilidades - Habilidades requeridas.
 * @param {Object} [opciones] - Opciones de filtrado.
 * @param {string} [opciones.coincidencia='alguna'] - 'alguna' o 'todas'.
 * @param {string} [opciones.campoHabilidades='habilidades'] - Campo que contiene las habilidades.
 * @returns {Array} Elementos filtrados.
 */
function filtrarPorHabilidades(items, habilidades, opciones = {}) {
  const { coincidencia = 'alguna', campoHabilidades = 'habilidades' } = opciones;

  if (!Array.isArray(items) || items.length === 0) return [];
  if (!Array.isArray(habilidades) || habilidades.length === 0) return items;

  const habilidadesSet = new Set(habilidades.map((h) => h.toLowerCase().trim()));

  return items.filter((item) => {
    const itemHabilidades = item[campoHabilidades] || [];
    if (!Array.isArray(itemHabilidades) || itemHabilidades.length === 0) {
      return false;
    }

    const itemHabilidadesSet = new Set(
      itemHabilidades.map((h) => h.toLowerCase().trim())
    );

    if (coincidencia === 'todas') {
      return [...habilidadesSet].every((h) => itemHabilidadesSet.has(h));
    }

    return [...itemHabilidadesSet].some((h) => habilidadesSet.has(h));
  });
}

/**
 * Construye la expresión de filtro para DynamoDB Query/Scan basada en habilidades.
 * @param {Array} habilidades - Habilidades para filtrar.
 * @param {Object} [opciones] - Opciones.
 * @param {string} [opciones.campoHabilidades='habilidades'] - Nombre del atributo en DynamoDB.
 * @param {string} [opciones.coincidencia='alguna'] - 'alguna' (OR) o 'todas' (AND).
 * @returns {Object} { FilterExpression?, ExpressionAttributeNames?, ExpressionAttributeValues? }
 */
function construirFiltroDynamoDB(habilidades, opciones = {}) {
  const { campoHabilidades = 'habilidades', coincidencia = 'alguna' } = opciones;

  if (!Array.isArray(habilidades) || habilidades.length === 0) {
    return {};
  }

  const nombresAtributos = {};
  const valoresAtributos = {};
  const condiciones = [];

  habilidades.forEach((habilidad, index) => {
    const nombrePh = `#h${index}`;
    const valorPh = `:v${index}`;
    nombresAtributos[nombrePh] = campoHabilidades;
    valoresAtributos[valorPh] = habilidad.toLowerCase().trim();
    condiciones.push(`contains(${nombrePh}, ${valorPh})`);
  });

  const operador = coincidencia === 'todas' ? ' AND ' : ' OR ';

  return {
    FilterExpression: condiciones.join(operador),
    ExpressionAttributeNames: nombresAtributos,
    ExpressionAttributeValues: valoresAtributos,
  };
}

module.exports = {
  calcularPuntuacion,
  cumpleNivelMinimo,
  filtrarPorDisponibilidad,
  ordenarPorPuntuacion,
  filtrarPorHabilidades,
  construirFiltroDynamoDB,
  NIVELES_VALIDOS,
  NIVELES_VALOR,
};