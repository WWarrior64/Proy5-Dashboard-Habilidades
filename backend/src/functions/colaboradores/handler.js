const colaboradoresRepository = require('../../../repositories/colaboradores.repository');

async function listarColaboradores(req, res) {
  try {
    const colaboradores = await colaboradoresRepository.listar();
    res.status(200).json(colaboradores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function obtenerColaborador(req, res) {
  res.status(200).json({ mensaje: 'Obtener colaborador por ID' });
}

async function crearColaborador(req, res) {
  res.status(201).json({ mensaje: 'Colaborador creado' });
}

async function actualizarColaborador(req, res) {
  res.status(200).json({ mensaje: 'Colaborador actualizado' });
}

async function eliminarColaborador(req, res) {
  res.status(200).json({ mensaje: 'Colaborador eliminado' });
}

module.exports = {
  listarColaboradores,
  obtenerColaborador,
  crearColaborador,
  actualizarColaborador,
  eliminarColaborador,
};