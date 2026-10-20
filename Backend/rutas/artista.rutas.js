const express = require('express');
const controlador = require('../controladores/artista.controlador');

const router = express.Router();

router.get('/:id', controlador.obtener);

module.exports = router;
