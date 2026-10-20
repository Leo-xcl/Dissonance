const express = require('express');
const { requiereAdmin } = require('../middlewares/autenticacion');
const controlador = require('../controladores/admin.controlador');

const router = express.Router();

router.use(requiereAdmin); // todo lo de este archivo es solo para administradores

router.get('/summary', controlador.resumen);
router.get('/orders', controlador.pedidos);
router.put('/orders/:id/status', controlador.cambiarEstado);
router.post('/orders/confirm-payment', controlador.confirmarPago);

router.get('/albums', controlador.albumes);
router.post('/albums', controlador.crearAlbum);
router.get('/albums/:id', controlador.albumParaEditar);
router.put('/albums/:id', controlador.editarAlbum);
router.delete('/albums/:id', controlador.ocultarAlbum);

module.exports = router;
