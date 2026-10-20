// Controlador del panel de administración (todas sus rutas exigen ser administrador)
const pedidoAdmin = require('../modelos/pedido-admin.modelo');
const catalogoAdmin = require('../modelos/catalogo-admin.modelo');

// --- Pedidos ---
const resumen = (req, res) => res.json(pedidoAdmin.resumen());
const pedidos = (req, res) => res.json(pedidoAdmin.listarPedidos());
const cambiarEstado = (req, res) => res.json(pedidoAdmin.cambiarEstado(Number(req.params.id), req.body.status));
const confirmarPago = (req, res) => res.json(pedidoAdmin.confirmarPago(req.body.code));

// --- Catálogo ---
const albumes = (req, res) => res.json(catalogoAdmin.listar());
const albumParaEditar = (req, res) => res.json(catalogoAdmin.obtenerParaEditar(Number(req.params.id)));
const crearAlbum = (req, res) => res.status(201).json({ id: catalogoAdmin.guardar(null, req.body) });
const editarAlbum = (req, res) => res.json({ id: catalogoAdmin.guardar(Number(req.params.id), req.body) });

function ocultarAlbum(req, res) {
  catalogoAdmin.ocultar(Number(req.params.id));
  res.json({ ok: true });
}

module.exports = { resumen, pedidos, cambiarEstado, confirmarPago, albumes, albumParaEditar, crearAlbum, editarAlbum, ocultarAlbum };
