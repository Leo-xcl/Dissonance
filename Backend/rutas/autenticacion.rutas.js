const express = require('express');
const controlador = require('../controladores/autenticacion.controlador');
const { requiereLogin } = require('../middlewares/autenticacion');

const router = express.Router();

router.post('/register', controlador.registrar);
router.post('/login', controlador.entrar);
router.post('/logout', controlador.salir);
router.get('/me', controlador.yo);
router.put('/me', requiereLogin, controlador.actualizar);

module.exports = router;
