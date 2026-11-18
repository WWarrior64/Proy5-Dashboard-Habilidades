// Las páginas se procesan secuencialmente, como requiere ExclusiveStartKey.
// La recursión asíncrona evita conservar un bucle con promesas pendientes.
async function recorrerPaginas(obtenerPagina, procesarPagina, clave = undefined) {
  const respuesta = await obtenerPagina(clave);
  procesarPagina(respuesta.Items || []);
  if (respuesta.LastEvaluatedKey) {
    return recorrerPaginas(obtenerPagina, procesarPagina, respuesta.LastEvaluatedKey);
  }
}

async function recolectarPaginas(obtenerPagina) {
  const items = [];
  await recorrerPaginas(obtenerPagina, pagina => items.push(...pagina));
  return items;
}

async function recorrerSecuencial(items, procesar, indice = 0) {
  if (indice >= items.length) return;
  await procesar(items[indice]);
  return recorrerSecuencial(items, procesar, indice + 1);
}

module.exports = { recorrerPaginas, recolectarPaginas, recorrerSecuencial };
