async function listarPostulaciones(req, res) {
  res.status(200).json([]);
}

async function crearPostulacion(req, res) {
  res.status(201).json({ mensaje: 'Postulación creada' });
}

module.exports = {
  listarPostulaciones,
  crearPostulacion,
};