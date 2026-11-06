/**
 * Filtra elementos por habilidades de forma eficiente usando Set para búsquedas O(1).
 * Al filtrar en memoria con estructuras optimizadas se evitan escaneos innecesarios
 * de DynamoDB (Scan sobre toda la tabla) cuando ya se dispone de los ítems.
 *
 * @param {Array} items - Lista de elementos a filtrar
 * @param {Array} habilidades - Habilidades requeridas
 * @param {Object} [opciones] - Opciones de filtrado
 * @param {string} [opciones.coincidencia='alguna'] - 'alguna' (al menos una) o 'todas' (todas las habilidades)
 * @param {string} [opciones.campoHabilidades='habilidades'] - Campo que contiene las habilidades en cada ítem
 * @returns {Array} Elementos filtrados
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
 * Permite que los repositorios usen operaciones dirigidas (Query con GSI o FilterExpression
 * acotado) en lugar de un Scan completo de la tabla.
 *
 * @param {Array} habilidades - Habilidades para filtrar
 * @param {Object} [opciones] - Opciones
 * @param {string} [opciones.campoHabilidades='habilidades'] - Nombre del atributo en DynamoDB
 * @param {string} [opciones.coincidencia='alguna'] - 'alguna' (OR) o 'todas' (AND)
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
  filtrarPorHabilidades,
  construirFiltroDynamoDB,
};