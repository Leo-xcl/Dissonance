const express = require('express');
const albumControlador = require('../controladores/album.controlador');
const resenaControlador = require('../controladores/resena.controlador');
const solicitudControlador = require('../controladores/solicitud.controlador');
const { sesionOpcional, requiereLogin } = require('../middlewares/autenticacion');

const router = express.Router();

router.get('/', albumControlador.listar);
router.get('/genres', albumControlador.generos); // antes de '/:id', para que "genres" no se tome como un id
router.get('/:id', albumControlador.obtener);

router.get('/:id/reviews', sesionOpcional, resenaControlador.listar);
router.post('/:id/reviews', requiereLogin, resenaControlador.guardar);

router.post('/:id/requests', requiereLogin, solicitudControlador.solicitar);

module.exports = router;
