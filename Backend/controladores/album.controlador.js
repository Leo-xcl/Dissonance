// Controlador del catálogo público: recibe la petición, llama al modelo y responde.
// Si el modelo lanza un error (falla), el manejador central de server.js lo convierte en respuesta.
const albumModelo = require('../modelos/album.modelo');

const listar = (req, res) => res.json(albumModelo.listar(req.query));
const generos = (req, res) => res.json(albumModelo.listarGeneros());
const obtener = (req, res) => res.json(albumModelo.obtener(Number(req.params.id)));

module.exports = { listar, generos, obtener };
