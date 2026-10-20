const express = require('express');
const controlador = require('../controladores/pedido.controlador');
const { requiereLogin } = require('../middlewares/autenticacion');

const router = express.Router();

// Cotizar y calcular el envío no necesitan sesión (el carrito se puede revisar antes de entrar)
router.post('/quote', controlador.cotizar);
router.get('/shipping', controlador.envio);

router.post('/', requiereLogin, controlador.crear);
router.get('/', requiereLogin, controlador.listar);
router.get('/:id', requiereLogin, controlador.obtener);

module.exports = router;
