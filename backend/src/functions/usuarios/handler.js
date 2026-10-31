async function listarUsuarios(req, res) {
  res.status(200).json([]);
}

async function crearUsuario(req, res) {
  res.status(201).json({ mensaje: 'Usuario creado' });
}

module.exports = {
  listarUsuarios,
  crearUsuario,
};