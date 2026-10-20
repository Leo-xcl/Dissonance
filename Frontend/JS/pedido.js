// Detalle de un pedido: estado con sus pasos, artículos, entrega y (si paga en tienda) el código de pago
const contenedor = document.getElementById('contenido-pedido');

function mensaje(texto) {
  contenedor.innerHTML = `<p class="muted">${texto} <a href="mi-cuenta.html#pedidos">Ir a mis pedidos</a></p>`;
}

// Pasos del flujo del pedido: los que ya se alcanzaron aparecen como hechos
function lineaDeTiempo(p) {
  const flujo = FLUJO_PEDIDO[p.delivery_method];
  const actual = flujo.indexOf(p.status); // -1 si todavía está pendiente de pago o fue cancelado
  const pasos = flujo.map((estado, i) => `
    <li class="${i <= actual ? 'done' : ''}"><span class="step">${String(i + 1).padStart(2, '0')}</span>
      <div><b>${NOMBRE_ESTADO[estado]}</b><small>${i < actual ? 'Listo' : i === actual ? 'Estado actual' : 'Pendiente'}</small></div></li>`);
  if (p.status === 'cancelled') {
    pasos.push(`<li class="cancelled-step"><span class="step">✕</span><div><b>${NOMBRE_ESTADO.cancelled}</b></div></li>`);
  }
  return `<ol class="timeline">${pasos.join('')}</ol>`;
}

function htmlEntrega(p) {
  if (p.delivery_method === 'pickup') {
    return '<p class="eyebrow">RECOGER EN TIENDA</p><p>Dissonance · Blvd. Riviera Nayarit #200-69</p>';
  }
  return `<p class="eyebrow">ENTREGA A DOMICILIO</p><p>${escapar(p.shipping_street)}, ${escapar(p.shipping_neighborhood)}, CP ${escapar(p.shipping_postal_code)}, ${escapar(p.shipping_city)}</p>`;
}

// Si se paga en tienda y falta pagar, se muestra el código que hay que presentar en caja
function htmlCodigoDePago(p) {
  if (p.payment_method !== 'store' || p.payment_status !== 'pending' || p.status === 'cancelled') return '';
  return `<section class="panel code-panel"><p class="eyebrow">PAGO EN SUCURSAL</p>
    <h2>Tu pedido está listo para pagar</h2>
    <p class="muted">Presenta este código en caja.</p>
    <div class="payment-code" aria-label="Código de pago">${escapar(p.payment_code)}</div>
    <div class="instructions">
      <div><b>1</b><p>Guarda o toma una captura de este código.</p></div>
      <div><b>2</b><p>Visita Dissonance en Blvd. Riviera Nayarit #200-69.</p></div>
      <div><b>3</b><p>Muestra el código en caja y paga ${pesos(p.total_cents)}.</p></div>
    </div></section>`;
}

function dibujar(p) {
  const articulos = p.items.map((i) =>
    `<p><span>${escapar(i.title_snapshot)} · ${NOMBRE_FORMATO[i.format_snapshot]} ×${i.quantity}</span><b>${pesos(i.subtotal_cents)}</b></p>`
  ).join('');
  const envio = p.delivery_method === 'shipping' ? `<p><span>Envío</span><b>${pesos(p.shipping_cents)}</b></p>` : '';
  const pago = p.payment_method === 'card' ? `Tarjeta ${escapar(p.card_brand || '')} terminada en ${escapar(p.card_last4 || '')}` : 'Pago en tienda';

  contenedor.innerHTML = `
    <h1>Pedido #${p.id}</h1>
    <p class="muted">Realizado el ${escapar(fechaLocal(p.created_at))}</p>
    ${htmlCodigoDePago(p)}
    <div class="two-col">
      <section class="panel"><h2>Estado del pedido</h2>${lineaDeTiempo(p)}</section>
      <aside class="panel summary"><h2>Resumen</h2><hr>
        ${articulos}${envio}
        <p class="total"><span>Total</span><b>${pesos(p.total_cents)}</b></p>
        <p class="muted">${pago}</p>
        ${htmlEntrega(p)}</aside>
    </div>`;
}

async function cargar() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return mensaje('No sabemos qué pedido mostrar.');
  const { ok, datos } = await llamarApi(`/api/orders/${encodeURIComponent(id)}`);
  if (!ok) return mensaje(escapar(datos.error || 'No se pudo cargar el pedido.'));
  dibujar(datos);
}

cargar();
