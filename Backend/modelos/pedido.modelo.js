// Pedidos del cliente: cotizar el carrito, calcular el envío, validar los datos y crear el pedido
const crypto = require('crypto');
const db = require('../base-de-datos');
const { falla } = require('./errores');
const { texto, entero } = require('./validar');
const { STOCK_VISIBLE_MAX, precioFinal } = require('./album.modelo');
const { validarTarjeta } = require('./tarjeta');

const MAX_POR_DISCO = 10; // piezas del mismo disco por pedido

// Tarifas fijas por código postal (en centavos). La tienda está en Bahía de Banderas, Nayarit (CP 63735).
function calcularEnvio(codigoPostal) {
  const cp = Number(codigoPostal);
  if (cp >= 63700 && cp <= 63799) return 4500; // local: Bahía de Banderas, Nayarit
  if (cp >= 48000 && cp <= 48999) return 7500; // Puerto Vallarta y alrededores
  return 12000; // resto del país
}

// El carrito vive en el navegador (solo trae variantId y quantity). Aquí se calculan precios y existencias REALES.
// Un disco "unavailable" ya no se puede comprar; si piden más piezas de las que hay, quantity queda en las que hay.
function cotizar(items) {
  const pedidos = {}; // variantId -> piezas pedidas (si un disco viene repetido se suman)
  for (const it of Array.isArray(items) ? items : []) {
    const id = entero(it.variantId, 1, 999999999, 'El carrito tiene un disco no válido.');
    const cantidad = entero(it.quantity, 1, MAX_POR_DISCO, `Puedes comprar hasta ${MAX_POR_DISCO} piezas de cada disco.`);
    pedidos[id] = Math.min((pedidos[id] || 0) + cantidad, MAX_POR_DISCO);
  }

  const lista = [];
  for (const [id, pedida] of Object.entries(pedidos)) {
    const v = db
      .prepare(
        `SELECT v.id AS variant_id, v.format, v.price_cents, v.discount_percent, v.stock_quantity,
                a.id AS album_id, a.title, a.cover_url, ar.name AS artist
           FROM album_variants v JOIN albums a ON a.id = v.album_id JOIN artists ar ON ar.id = a.artist_id
          WHERE v.id = ? AND v.is_active = 1 AND a.is_active = 1`
      )
      .get(Number(id));
    if (!v) {
      lista.push({ variant_id: Number(id), unavailable: true, title: 'Este disco ya no está en el catálogo', requested_quantity: pedida, quantity: 0, subtotal_cents: 0 });
      continue;
    }
    const cantidad = Math.min(pedida, v.stock_quantity);
    const unitario = precioFinal(v.price_cents, v.discount_percent);
    lista.push({
      variant_id: v.variant_id, album_id: v.album_id, title: v.title, artist: v.artist, format: v.format,
      cover_url: v.cover_url, unit_price_cents: unitario, requested_quantity: pedida, quantity: cantidad,
      unavailable: cantidad === 0, subtotal_cents: unitario * cantidad,
      available: Math.min(v.stock_quantity, STOCK_VISIBLE_MAX), // al público, como en el catálogo: "hasta 10"
    });
  }
  return { items: lista, subtotal_cents: lista.reduce((suma, i) => suma + i.subtotal_cents, 0) };
}

// Revisa contacto, entrega y pago ANTES de tocar la base
function validarPedido(d) {
  const contacto = d.contact || {};
  const domicilio = d.address || {};
  const pago = d.payment || {};

  if (d.delivery !== 'pickup' && d.delivery !== 'shipping') throw falla(400, 'Elige cómo quieres recibir tu pedido.');
  const nombre = texto(contacto.name, 2, 100, 'Escribe el nombre de contacto.');
  const telefono = String(contacto.phone || '').replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(telefono)) throw falla(400, 'El teléfono debe tener 10 dígitos.');

  let direccion = {};
  let envio = 0;
  if (d.delivery === 'shipping') {
    direccion = {
      calle: texto(domicilio.street, 3, 120, 'Escribe la calle y el número.'),
      colonia: texto(domicilio.neighborhood, 2, 80, 'Escribe la colonia.'),
      cp: String(domicilio.postalCode || '').trim(),
      ciudad: texto(domicilio.city, 2, 80, 'Escribe la ciudad.'),
    };
    if (!/^\d{5}$/.test(direccion.cp)) throw falla(400, 'El código postal debe tener 5 dígitos.');
    envio = calcularEnvio(direccion.cp);
  }

  if (pago.method !== 'card' && pago.method !== 'store') throw falla(400, 'Elige cómo quieres pagar.');
  const tarjeta = pago.method === 'card' ? validarTarjeta(pago.card || {}) : null;
  return { entrega: d.delivery, nombre, telefono, direccion, envio, metodoPago: pago.method, tarjeta };
}

// Regresa al inventario los discos de un pedido cancelado
function devolverStock(idPedido) {
  const items = db.prepare('SELECT variant_id, quantity FROM order_items WHERE order_id = ?').all(idPedido);
  for (const it of items) {
    db.prepare('UPDATE album_variants SET stock_quantity = stock_quantity + ? WHERE id = ?').run(it.quantity, it.variant_id);
  }
}

function crear(usuario, datos) {
  const p = validarPedido(datos);
  const pagado = p.metodoPago === 'card'; // con tarjeta el pedido nace pagado; en tienda queda pendiente hasta que paguen en caja

  // Todo o nada: si algo falla a la mitad, no queda nada guardado
  const idPedido = db.transaction(() => {
    const cot = cotizar(datos.items); // precios y existencias reales, dentro de la transacción
    if (cot.items.length === 0) throw falla(400, 'Tu carrito está vacío.');
    if (cot.items.some((i) => i.unavailable || i.quantity < i.requested_quantity)) {
      throw falla(409, 'Tu carrito cambió: algún disco ya no está disponible en esa cantidad. Revísalo antes de pagar.');
    }
    for (const i of cot.items) {
      const r = db
        .prepare('UPDATE album_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?')
        .run(i.quantity, i.variant_id, i.quantity);
      if (r.changes !== 1) throw falla(409, `Ya no hay existencias suficientes de "${i.title}".`);
    }

    const r = db
      .prepare(
        `INSERT INTO orders (user_id, delivery_method, status, payment_method, payment_status, card_brand, card_last4,
           subtotal_cents, shipping_cents, total_cents, contact_name, contact_phone,
           shipping_street, shipping_neighborhood, shipping_postal_code, shipping_city)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        usuario.id, p.entrega, pagado ? 'confirmed' : 'pending', p.metodoPago, pagado ? 'paid' : 'pending',
        p.tarjeta ? p.tarjeta.marca : null, p.tarjeta ? p.tarjeta.ultimos4 : null,
        cot.subtotal_cents, p.envio, cot.subtotal_cents + p.envio, p.nombre, p.telefono,
        p.direccion.calle || null, p.direccion.colonia || null, p.direccion.cp || null, p.direccion.ciudad || null
      );
    const id = Number(r.lastInsertRowid);

    for (const i of cot.items) {
      db.prepare(
        `INSERT INTO order_items (order_id, variant_id, title_snapshot, artist_snapshot, format_snapshot, unit_price_cents, quantity, subtotal_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, i.variant_id, i.title, i.artist, i.format, i.unit_price_cents, i.quantity, i.subtotal_cents);
    }
    if (!pagado) {
      // Pago en tienda: el cliente presenta este código en caja
      db.prepare('UPDATE orders SET payment_code = ? WHERE id = ?').run(`DIS-${id}-${crypto.randomInt(1000, 10000)}`, id);
    }
    return id;
  })();

  return db
    .prepare('SELECT id AS order_id, status, payment_method, payment_status, payment_code, subtotal_cents, shipping_cents, total_cents FROM orders WHERE id = ?')
    .get(idPedido);
}

// Pedidos del usuario con sesión, del más reciente al más antiguo
function listar(usuario) {
  return db
    .prepare(
      `SELECT o.id, o.created_at, o.status, o.total_cents, o.delivery_method, o.payment_method, o.payment_status,
              (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS items_count
         FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC`
    )
    .all(usuario.id);
}

// Un pedido solo lo ve su dueño (o un administrador). Para cualquier otro, "no existe".
function obtener(id, usuario) {
  const pedido = db
    .prepare(
      `SELECT id, user_id, status, delivery_method, payment_method, payment_status, payment_code, card_brand, card_last4,
              subtotal_cents, shipping_cents, total_cents, contact_name, contact_phone,
              shipping_street, shipping_neighborhood, shipping_postal_code, shipping_city, created_at
         FROM orders WHERE id = ?`
    )
    .get(id);
  if (!pedido || (pedido.user_id !== usuario.id && usuario.role !== 'admin')) throw falla(404, 'Pedido no encontrado.');
  delete pedido.user_id;
  pedido.items = db
    .prepare('SELECT title_snapshot, artist_snapshot, format_snapshot, unit_price_cents, quantity, subtotal_cents FROM order_items WHERE order_id = ? ORDER BY id')
    .all(id);
  return pedido;
}

module.exports = { calcularEnvio, cotizar, crear, listar, obtener, devolverStock };
