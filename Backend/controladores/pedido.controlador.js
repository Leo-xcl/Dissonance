const pedidoModelo = require('../modelos/pedido.modelo');

const cotizar = (req, res) => res.json(pedidoModelo.cotizar(req.body.items));
const envio = (req, res) => res.json({ shipping_cents: pedidoModelo.calcularEnvio(req.query.cp) });
const crear = (req, res) => res.status(201).json(pedidoModelo.crear(req.usuario, req.body));
const listar = (req, res) => res.json(pedidoModelo.listar(req.usuario));
const obtener = (req, res) => res.json(pedidoModelo.obtener(Number(req.params.id), req.usuario));

module.exports = { cotizar, envio, crear, listar, obtener };
