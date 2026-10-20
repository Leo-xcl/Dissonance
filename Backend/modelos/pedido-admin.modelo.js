// Pedidos vistos por el administrador: cambiar su estado, confirmar pagos en caja y el resumen del panel
const db = require('../base-de-datos');
const { falla } = require('./errores');
const { devolverStock } = require('./pedido.modelo');
const { masSolicitados } = require('./solicitud.modelo');

// Pasos de cada tipo de entrega. Un pedido solo puede avanzar (se permite saltar pasos) o cancelarse.
const FLUJO = {
  shipping: ['confirmed', 'preparing', 'shipped', 'delivered'],
  pickup: ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up'],
};
const TERMINALES = ['delivered', 'picked_up', 'cancelled'];

// Estados a los que puede pasar un pedido. Si todavía no se paga, lo único posible es cancelarlo.
function siguientes(pedido) {
  if (TERMINALES.includes(pedido.status)) return [];
  if (pedido.payment_status !== 'paid') return ['cancelled'];
  const flujo = FLUJO[pedido.delivery_method];
  return [...flujo.slice(flujo.indexOf(pedido.status) + 1), 'cancelled'];
}

// Todos los pedidos con sus discos (para saber qué se vendió y qué regresa al inventario si se cancela)
function listarPedidos() {
  const lineas = db.prepare('SELECT order_id, title_snapshot AS title, format_snapshot AS format, quantity FROM order_items ORDER BY id').all();
  return db
    .prepare(
      `SELECT o.id, o.created_at, o.status, o.delivery_method, o.payment_method, o.payment_status, o.total_cents,
              u.full_name AS customer_name, u.email AS customer_email
         FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC`
    )
    .all()
    .map((p) => ({ ...p, items: lineas.filter((l) => l.order_id === p.id), next_statuses: siguientes(p) }));
}

function cambiarEstado(id, nuevo) {
  return db.transaction(() => {
    const pedido = db.prepare('SELECT id, status, delivery_method, payment_status FROM orders WHERE id = ?').get(id);
    if (!pedido) throw falla(404, 'Pedido no encontrado.');
    if (!siguientes(pedido).includes(nuevo)) throw falla(409, 'Ese cambio de estado no es válido para este pedido.');
    if (nuevo === 'cancelled') devolverStock(id);
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(nuevo, id);
    return { order_id: id, status: nuevo };
  })();
}

// El cliente paga en caja y el administrador captura su código
function confirmarPago(codigo) {
  const code = String(codigo || '').trim().toUpperCase();
  if (!code) throw falla(400, 'Escribe el código de pago.');
  const pedido = db.prepare('SELECT id, status, payment_status, total_cents FROM orders WHERE payment_code = ?').get(code);
  if (!pedido) throw falla(404, 'No existe un pedido con ese código.');
  if (pedido.payment_status === 'paid') throw falla(409, 'Ese pedido ya estaba pagado.');
  if (pedido.status === 'cancelled') throw falla(409, 'Ese pedido fue cancelado.');
  db.prepare("UPDATE orders SET payment_status = 'paid', status = 'confirmed' WHERE id = ?").run(pedido.id);
  return { order_id: pedido.id, total_cents: pedido.total_cents };
}

// Reporte de ventas: los 5 discos con más piezas vendidas este mes (sin contar pedidos cancelados)
function masVendidos() {
  return db
    .prepare(
      `SELECT al.title, SUM(oi.quantity) AS units
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         JOIN album_variants v ON v.id = oi.variant_id JOIN albums al ON al.id = v.album_id
        WHERE o.status != 'cancelled' AND strftime('%Y-%m', o.created_at) = strftime('%Y-%m', 'now')
        GROUP BY al.id ORDER BY units DESC, al.title LIMIT 5`
    )
    .all();
}

// Formatos que están por acabarse (5 piezas o menos), para saber qué volver a comprar
function stockBajo() {
  return db
    .prepare(
      `SELECT al.title, v.format, v.stock_quantity FROM album_variants v JOIN albums al ON al.id = v.album_id
        WHERE v.is_active = 1 AND al.is_active = 1 AND v.stock_quantity <= 5
        ORDER BY v.stock_quantity, al.title LIMIT 5`
    )
    .all();
}

function resumen() {
  const pedidos = listarPedidos();
  const ventas = db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) AS cents, COUNT(*) AS n FROM orders
        WHERE payment_status = 'paid' AND status != 'cancelled' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    )
    .get();
  return {
    sales_cents: ventas.cents,
    paid_orders_this_month: ventas.n,
    to_prepare: pedidos.filter((p) => ['confirmed', 'preparing'].includes(p.status)).length,
    awaiting_payment: pedidos.filter((p) => p.status === 'pending').length,
    top_sellers: masVendidos(),
    low_stock: stockBajo(),
    most_requested: masSolicitados(5),
  };
}

module.exports = { listarPedidos, cambiarEstado, confirmarPago, resumen };
