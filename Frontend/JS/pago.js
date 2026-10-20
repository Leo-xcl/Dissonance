const formulario = document.getElementById('form-pago');
const mensaje = document.getElementById('mensaje');
const btnConfirmar = document.getElementById('btn-confirmar');
const valor = (id) => document.getElementById(id).value.trim();
const elegido = (nombre) => document.querySelector(`input[name="${nombre}"]:checked`).value;

let subtotal = 0;
let envio = 0;

function pintarTotales() {
  const aDomicilio = elegido('entrega') === 'shipping';
  const cpValido = /^\d{5}$/.test(valor('cp'));
  document.getElementById('res-subtotal').textContent = pesos(subtotal);
  document.getElementById('res-envio').textContent = !aDomicilio ? 'Sin costo' : cpValido ? pesos(envio) : 'Escribe tu código postal';
  document.getElementById('res-total').textContent = pesos(subtotal + (aDomicilio ? envio : 0));
}

async function calcularEnvio() {
  envio = 0;
  if (/^\d{5}$/.test(valor('cp'))) {
    const { ok, datos } = await llamarApi(`/api/orders/shipping?cp=${valor('cp')}`);
    if (ok) envio = datos.shipping_cents;
  }
  pintarTotales();
}

// Muestra solo los campos que corresponden a lo elegido (domicilio / tarjeta)
function actualizarVista() {
  const tarjeta = elegido('pago') === 'card';
  document.getElementById('campos-envio').hidden = elegido('entrega') !== 'shipping';
  document.getElementById('campos-tarjeta').hidden = !tarjeta;
  document.getElementById('nota-pago').textContent = tarjeta
    ? 'Pago simulado: validamos el formato de la tarjeta, pero no se realiza ningún cobro y no guardamos el número completo.'
    : 'Al confirmar recibirás un código para pagar en caja.';
  pintarTotales();
}

async function iniciar() {
  const locales = leerCarrito();
  if (locales.length === 0) {
    formulario.innerHTML = '<div><p class="muted">Tu carrito está vacío.</p><a href="catalogo.html">← Ir al catálogo</a></div>';
    return;
  }
  const { ok, datos } = await llamarApi('/api/orders/quote', 'POST', { items: locales });
  if (!ok) {
    mensaje.textContent = 'No se pudo cargar tu pedido. Intenta de nuevo.';
    return;
  }
  // Si algo cambió (existencias o disponibilidad), el carrito lo corrige y avisa
  if (datos.items.some((i) => i.unavailable || i.quantity < i.requested_quantity)) {
    window.location.href = 'carrito.html';
    return;
  }
  subtotal = datos.subtotal_cents;
  document.getElementById('resumen-items').innerHTML = datos.items
    .map((i) => `<p><span>${escapar(i.title)} · ${NOMBRE_FORMATO[i.format]} ×${i.quantity}</span><b>${pesos(i.subtotal_cents)}</b></p>`)
    .join('');

  const usuario = await obtenerUsuario();
  if (usuario) document.getElementById('contacto').value = usuario.name;
  else btnConfirmar.textContent = 'Iniciar sesión para confirmar';
  actualizarVista();
}

formulario.addEventListener('change', actualizarVista);
document.getElementById('cp').addEventListener('input', calcularEnvio);

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mensaje.textContent = '';
  if (!(await obtenerUsuario())) { window.location.href = 'login.html'; return; }

  const entrega = elegido('entrega');
  const metodo = elegido('pago');
  const pedido = {
    items: leerCarrito(),
    delivery: entrega,
    contact: { name: valor('contacto'), phone: valor('tel') },
    payment: { method: metodo },
  };
  if (entrega === 'shipping') {
    pedido.address = { street: valor('direccion'), neighborhood: valor('colonia'), postalCode: valor('cp'), city: valor('ciudad') };
  }
  if (metodo === 'card') {
    pedido.payment.card = { holder: valor('titular'), number: valor('tarjeta'), expiry: valor('vence'), cvv: valor('cvv') };
  }

  btnConfirmar.disabled = true;
  const { ok, datos } = await llamarApi('/api/orders', 'POST', pedido);
  btnConfirmar.disabled = false;
  if (!ok) {
    mensaje.textContent = datos.error || 'No se pudo crear el pedido.';
    return;
  }
  guardarCarrito([]);
  window.location.href = `pedido.html?id=${datos.order_id}`;
});

// Formato mientras escribe: número en grupos de 4, vencimiento MM/AA y CVV solo dígitos
document.getElementById('tarjeta').addEventListener('input', (e) => {
  const digitos = e.target.value.replace(/\D/g, '').slice(0, 16);
  e.target.value = digitos.replace(/(.{4})/g, '$1 ').trim();
});
document.getElementById('vence').addEventListener('input', (e) => {
  const digitos = e.target.value.replace(/\D/g, '').slice(0, 4);
  const borrando = e.inputType === 'deleteContentBackward';
  e.target.value = digitos.length > 2 || (digitos.length === 2 && !borrando) ? digitos.slice(0, 2) + '/' + digitos.slice(2) : digitos;
});
document.getElementById('cvv').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
});

iniciar();
