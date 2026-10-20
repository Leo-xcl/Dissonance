const lista = document.getElementById('lista-carrito');
const btnPago = document.getElementById('btn-pago');
let avisos = [];

function pintarResumen(unidades, subtotal) {
  document.getElementById('res-unidades').textContent = `Subtotal · ${unidades} unidad${unidades === 1 ? '' : 'es'}`;
  document.getElementById('res-subtotal').textContent = pesos(subtotal);
  document.getElementById('res-total').textContent = pesos(subtotal);
  document.getElementById('titulo-carrito').textContent =
    unidades > 0 ? `Tu carrito / ${unidades} artículo${unidades === 1 ? '' : 's'}` : 'Tu carrito';
  btnPago.style.pointerEvents = unidades > 0 ? '' : 'none';
  btnPago.style.opacity = unidades > 0 ? '' : '0.5';
}

function pintarVacio() {
  lista.innerHTML = '<p class="muted">Tu carrito está vacío.</p><a href="catalogo.html">← Ir al catálogo</a>';
  pintarResumen(0, 0);
}

// Portada pequeña: la imagen real, o el cuadro de color con las iniciales si el álbum no tiene
function miniPortada(i) {
  if (i.cover_url) {
    return `<img class="mini-cover" src="${escapar(urlPortada(i.cover_url))}" alt="Portada de ${escapar(i.title)}" referrerpolicy="no-referrer">`;
  }
  return `<div class="mini-cover cover-${colorPortada(i.album_id)}">${escapar(iniciales(i.title))}</div>`;
}

function pintar(cotizacion) {
  const avisoHtml = avisos.map((a) => `<p class="muted" role="status">${escapar(a)}</p>`).join('');
  const filas = cotizacion.items.map((i) => `
    <article class="cart-item">
      ${miniPortada(i)}
      <div><h2>${escapar(i.title)}</h2><p>${escapar(i.artist)} · ${NOMBRE_FORMATO[i.format]} · ${textoExistencias(i.available)}</p>
        <a href="#" data-quitar="${i.variant_id}">Quitar</a></div>
      <label>Cantidad <input type="number" min="1" max="${Math.min(10, i.available)}" value="${i.quantity}" data-cantidad="${i.variant_id}"></label>
      <strong>${pesos(i.subtotal_cents)}</strong>
    </article>`).join('');
  lista.innerHTML = avisoHtml + filas + '<a href="catalogo.html">← Seguir comprando</a>';
  pintarResumen(cotizacion.items.reduce((suma, i) => suma + i.quantity, 0), cotizacion.subtotal_cents);
}

// Deja en el navegador solo lo que realmente se puede comprar, y avisa de lo que cambió
function sincronizar(cotizacion) {
  avisos = [];
  const validos = [];
  for (const i of cotizacion.items) {
    if (i.unavailable) {
      avisos.push('Quitamos un artículo que ya no está disponible.');
      continue;
    }
    if (i.quantity < i.requested_quantity) avisos.push(`De "${i.title}" solo quedan ${i.quantity}; ajustamos la cantidad.`);
    validos.push({ variantId: i.variant_id, quantity: i.quantity });
  }
  guardarCarrito(validos);
  cotizacion.items = cotizacion.items.filter((i) => !i.unavailable);
}

async function cargar() {
  const locales = leerCarrito();
  if (locales.length === 0) {
    pintarVacio();
  } else {
    const { ok, datos } = await llamarApi('/api/orders/quote', 'POST', { items: locales });
    if (!ok) {
      lista.innerHTML = '<p class="muted">No se pudo cargar el carrito. Intenta de nuevo.</p>';
    } else {
      sincronizar(datos);
      if (datos.items.length === 0) pintarVacio();
      else pintar(datos);
    }
  }
  actualizarContadorCarrito();
}

lista.addEventListener('click', (evento) => {
  const id = evento.target.dataset.quitar;
  if (!id) return;
  evento.preventDefault();
  avisos = [];
  guardarCarrito(leerCarrito().filter((i) => i.variantId !== Number(id)));
  cargar();
});

lista.addEventListener('change', (evento) => {
  const id = evento.target.dataset.cantidad;
  if (!id) return;
  const cantidad = Math.max(1, Math.min(10, parseInt(evento.target.value, 10) || 1));
  guardarCarrito(leerCarrito().map((i) => (i.variantId === Number(id) ? { ...i, quantity: cantidad } : i)));
  cargar();
});

cargar();
