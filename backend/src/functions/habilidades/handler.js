async function listarHabilidades(req, res) {
  res.status(200).json([]);
}

async function crearHabilidad(req, res) {
  res.status(201).json({ mensaje: 'Habilidad creada' });
}

module.exports = {
  listarHabilidades,
  crearHabilidad,
};