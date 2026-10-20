// Panel de pedidos: resumen del mes, lista de pedidos con cambio de estado y confirmación de pagos en caja
const tabla = document.getElementById('tabla-pedidos');
const avisoTabla = document.getElementById('aviso-tabla');
const formPago = document.getElementById('form-pago');
const avisoPago = document.getElementById('aviso-pago');

// ---- Resumen
function tarjeta(titulo, valor, detalle) {
  return `<article class="panel metric"><small>${titulo}</small><strong>${valor}</strong><span>${detalle}</span></article>`;
}

// Un reporte del panel: título y una línea por fila (o el texto de "vacío" si no hay datos)
function reporte(titulo, filas, vacio) {
  const lineas = filas.length ? filas.map((f) => `<p>${f}</p>`).join('') : `<p class="muted">${vacio}</p>`;
  return `<section class="panel"><h2>${titulo}</h2>${lineas}</section>`;
}

function dibujarResumen(r) {
  const mes = new Date().toLocaleDateString('es-MX', { month: 'long' });
  const piezas = (n) => `${n} pieza${n === 1 ? '' : 's'}`;
  document.getElementById('resumen').innerHTML = `<section class="metric-grid">
    ${tarjeta('Ventas del mes', pesos(r.sales_cents), `${mes} · pedidos pagados`)}
    ${tarjeta('Pedidos del mes', r.paid_orders_this_month, 'pagados y no cancelados')}
    ${tarjeta('Por preparar', r.to_prepare, 'confirmados o en preparación')}
    ${tarjeta('Sin pagar', r.awaiting_payment, 'esperan su pago en tienda')}
  </section>
  <div class="report-grid">
    ${reporte('Más vendidos del mes', r.top_sellers.map((a) => `${escapar(a.title)} · ${piezas(a.units)}`), 'Sin ventas este mes.')}
    ${reporte('Más solicitados', r.most_requested.map((a) => `${escapar(a.title)} <small>(${escapar(a.artist)})</small> · ${a.requests} solicitud${a.requests === 1 ? '' : 'es'}`), 'Nadie ha solicitado discos todavía.')}
    ${reporte('Stock bajo', r.low_stock.map((v) => `${escapar(v.title)} · ${NOMBRE_FORMATO[v.format]} · ${v.stock_quantity === 0 ? 'Agotado' : piezas(v.stock_quantity)}`), 'Todo el inventario tiene más de 5 piezas.')}
  </div>`;
}

// ---- Pedidos
let pedidos = []; // todos los pedidos que devolvió el servidor
const verMas = crearVerMas(document.getElementById('ver-mas-pedidos'), document.getElementById('contador-pedidos'), 'pedidos', pintar);

function textoPago(p) {
  return p.payment_status === 'paid' ? 'Pagado' : 'Por pagar';
}

function celdaAccion(p) {
  if (p.next_statuses.length === 0) return '<span class="muted">Sin cambios posibles</span>';
  const opciones = p.next_statuses.map((e) => `<option value="${e}">${NOMBRE_ESTADO[e]}</option>`).join('');
  return `<select aria-label="Cambiar estado del pedido #${p.id}" data-selector="${p.id}">
      <option value="">Cambiar a…</option>${opciones}</select>
    <button type="button" class="button secondary" data-guardar="${p.id}" disabled>Guardar</button>`;
}

// "2 × Parklife (Vinilo)", un disco por renglón
function htmlDiscos(items) {
  return items.map((i) => `${i.quantity} × ${escapar(i.title)} <small>(${NOMBRE_FORMATO[i.format]})</small>`).join('<br>');
}

function filaPedido(p) {
  return `<tr><td><a href="pedido.html?id=${p.id}">#${p.id}</a></td>
    <td>${escapar(p.customer_name)}<br><small>${escapar(p.customer_email)}</small></td>
    <td>${htmlDiscos(p.items)}</td>
    <td>${NOMBRE_ENTREGA[p.delivery_method]}</td><td>${textoPago(p)}</td>
    <td><span class="status ${claseEstado(p.status)}">${NOMBRE_ESTADO[p.status]}</span></td>
    <td>${celdaAccion(p)}</td></tr>`;
}

// Dibuja los primeros 20 pedidos (o los que pida "Ver más")
function pintar() {
  tabla.innerHTML = pedidos.length
    ? verMas.recortar(pedidos).map(filaPedido).join('')
    : '<tr><td colspan="7" class="muted">Todavía no hay pedidos.</td></tr>';
}

async function cargar() {
  const resumen = await llamarApi('/api/admin/summary');
  if (resumen.ok) dibujarResumen(resumen.datos);
  const lista = await llamarApi('/api/admin/orders');
  if (lista.ok) {
    pedidos = lista.datos; // al recargar tras guardar un cambio se conserva cuántos se estaban viendo
    pintar();
  } else {
    tabla.innerHTML = '<tr><td colspan="7" class="muted">No se pudieron cargar los pedidos.</td></tr>';
  }
}

// El botón Guardar solo se activa cuando se eligió un estado
tabla.addEventListener('change', (e) => {
  const id = e.target.dataset.selector;
  if (id) tabla.querySelector(`[data-guardar="${id}"]`).disabled = !e.target.value;
});

tabla.addEventListener('click', async (e) => {
  const id = e.target.dataset.guardar;
  if (!id) return;
  const nuevo = tabla.querySelector(`[data-selector="${id}"]`).value;
  if (nuevo === 'cancelled' && !confirm(`¿Cancelar el pedido #${id}? Los discos regresarán al inventario y no se puede deshacer.`)) return;
  e.target.disabled = true;
  const { ok, datos } = await llamarApi(`/api/admin/orders/${id}/status`, 'PUT', { status: nuevo });
  avisoTabla.textContent = ok ? `Pedido #${id} actualizado a "${NOMBRE_ESTADO[nuevo]}".` : (datos.error || 'No se pudo cambiar el estado.');
  await cargar(); // siempre se recarga: un error 409 puede significar que el estado ya cambió
});

formPago.addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = document.getElementById('codigo-pago').value.trim();
  if (!codigo) { avisoPago.textContent = 'Escribe el código del cliente.'; return; }
  const { ok, datos } = await llamarApi('/api/admin/orders/confirm-payment', 'POST', { code: codigo });
  avisoPago.textContent = ok ? `Pago confirmado: pedido #${datos.order_id} por ${pesos(datos.total_cents)}.` : (datos.error || 'No se pudo confirmar el pago.');
  if (ok) { formPago.reset(); await cargar(); }
});

cargar();
