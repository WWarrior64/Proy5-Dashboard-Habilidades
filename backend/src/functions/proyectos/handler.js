async function listarProyectos(req, res) {
  res.status(200).json([]);
}

async function obtenerProyecto(req, res) {
  res.status(200).json({ mensaje: 'Obtener proyecto por ID' });
}

async function crearProyecto(req, res) {
  res.status(201).json({ mensaje: 'Proyecto creado' });
}

async function actualizarProyecto(req, res) {
  res.status(200).json({ mensaje: 'Proyecto actualizado' });
}

async function eliminarProyecto(req, res) {
  res.status(200).json({ mensaje: 'Proyecto cancelado/eliminado' });
}

module.exports = {
  listarProyectos,
  obtenerProyecto,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
};