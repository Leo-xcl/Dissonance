const formulario = document.getElementById('form-login');
const mensaje = document.getElementById('mensaje');

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault(); // evita que el formulario recargue la página
  mensaje.textContent = '';

  const { ok, datos } = await llamarApi('/api/auth/login', 'POST', {
    email: document.getElementById('correo').value.trim(),
    password: document.getElementById('contrasena').value,
  });
  if (!ok) {
    mensaje.textContent = datos.error || 'No se pudo iniciar sesión.';
    return;
  }
  window.location.href = datos.role === 'admin' ? 'admin.html' : 'catalogo.html';
});
