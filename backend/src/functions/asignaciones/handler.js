async function listarAsignaciones(req, res) {
  res.status(200).json([]);
}

async function crearAsignacion(req, res) {
  res.status(201).json({ mensaje: 'Asignación creada' });
}

module.exports = {
  listarAsignaciones,
  crearAsignacion,
};