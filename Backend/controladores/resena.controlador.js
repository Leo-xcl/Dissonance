const resenaModelo = require('../modelos/resena.modelo');

const listar = (req, res) => res.json(resenaModelo.listar(Number(req.params.id), req.usuario));

function guardar(req, res) {
  resenaModelo.guardar(req.usuario, Number(req.params.id), req.body);
  res.status(201).json(resenaModelo.listar(Number(req.params.id), req.usuario));
}

module.exports = { listar, guardar };
