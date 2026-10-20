const formulario = document.getElementById('form-registro');
const mensaje = document.getElementById('mensaje');

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mensaje.textContent = '';

  const { ok, datos } = await llamarApi('/api/auth/register', 'POST', {
    name: document.getElementById('nombre').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('telefono').value.trim(),
    password: document.getElementById('pass').value,
  });
  if (!ok) {
    mensaje.textContent = datos.error || 'No se pudo crear la cuenta.';
    return;
  }
  window.location.href = 'catalogo.html'; // la cuenta queda con sesión iniciada
});
