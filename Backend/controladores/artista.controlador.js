const artistaModelo = require('../modelos/artista.modelo');

const obtener = (req, res) => res.json(artistaModelo.obtener(Number(req.params.id)));

module.exports = { obtener };
