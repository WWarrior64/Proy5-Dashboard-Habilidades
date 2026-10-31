function exito(res, datos, codigo = 200) {
  return res.status(codigo).json(datos);
}

function error(res, mensaje, codigo = 500) {
  return res.status(codigo).json({ error: mensaje });
}

module.exports = { exito, error };