// Mi cuenta: la lista de pedidos del cliente y el formulario para cambiar sus datos y su contraseña
const formulario = document.getElementById('form-cuenta');
const mensaje = document.getElementById('mensaje');
const contenedorPedidos = document.getElementById('contenido-pedidos');
const campo = (id) => document.getElementById(id);

function pintarPerfil(u) {
  const desde = new Date(u.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  campo('perfil-nombre').textContent = u.name;
  campo('perfil-desde').textContent = `${u.role === 'admin' ? 'Administrador' : 'Cliente'} desde ${desde}`;
  campo('avatar').textContent = u.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  campo('nombre').value = u.name;
  campo('telefono').value = u.phone || '';
  campo('correo').value = u.email;
}

function filaPedido(p) {
  const articulos = `${p.items_count} artículo${p.items_count === 1 ? '' : 's'}`;
  const enlace = p.payment_method === 'store' && p.payment_status === 'pending' && p.status !== 'cancelled'
    ? 'Ver código de pago →'
    : 'Ver detalle →';
  return `<tr>
    <td>#${p.id}</td>
    <td>${escapar(fechaLocal(p.created_at))} · ${articulos}</td>
    <td>${pesos(p.total_cents)}</td>
    <td><span class="status ${claseEstado(p.status)}">${NOMBRE_ESTADO[p.status]}</span></td>
    <td><a href="pedido.html?id=${p.id}">${enlace}</a></td></tr>`;
}

async function cargarPedidos() {
  const { ok, datos } = await llamarApi('/api/orders');
  if (!ok) {
    contenedorPedidos.innerHTML = '<p class="muted">No se pudieron cargar tus pedidos. Intenta de nuevo.</p>';
  } else if (datos.length === 0) {
    contenedorPedidos.innerHTML = '<p class="muted">Aún no tienes pedidos. <a href="catalogo.html">Explora el catálogo</a>.</p>';
  } else {
    contenedorPedidos.innerHTML = `<table><thead><tr><th>Pedido</th><th>Fecha · artículos</th><th>Total</th><th>Estado</th><th>Detalle</th></tr></thead>
      <tbody>${datos.map(filaPedido).join('')}</tbody></table>`;
  }
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mensaje.textContent = '';
  const datos = { name: campo('nombre').value, phone: campo('telefono').value, email: campo('correo').value };
  if (campo('contrasena').value) {
    datos.new_password = campo('contrasena').value;
    datos.current_password = campo('contrasena-actual').value;
  }
  const respuesta = await llamarApi('/api/auth/me', 'PUT', datos);
  if (!respuesta.ok) {
    mensaje.textContent = respuesta.datos.error || 'No se pudieron guardar los cambios.';
    return;
  }
  pintarPerfil(respuesta.datos);
  campo('contrasena').value = '';
  campo('contrasena-actual').value = '';
  mensaje.textContent = 'Cambios guardados.';
});

obtenerUsuario().then((usuario) => {
  if (!usuario) {
    window.location.href = 'login.html';
    return;
  }
  pintarPerfil(usuario);
  cargarPedidos();
});
