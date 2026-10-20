const solicitudModelo = require('../modelos/solicitud.modelo');

// 201 si es una solicitud nueva; 200 si la persona ya lo había pedido (no es un error: ya está anotado)
function solicitar(req, res) {
  const { nueva } = solicitudModelo.solicitar(req.usuario, Number(req.params.id));
  res.status(nueva ? 201 : 200).json({ new_request: nueva });
}

module.exports = { solicitar };
