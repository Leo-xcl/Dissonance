// Encabezado y pie de página: son iguales en todas las páginas, así que se dibujan aquí, una sola vez.
// Cada HTML solo trae <header class="site-header wrap"></header> y <footer class="site-footer wrap"></footer> vacíos.
// Se carga DESPUÉS de comun.js y ANTES del archivo de cada página (que busca el buscador del encabezado).
const ENCABEZADO = `
  <a class="brand" href="catalogo.html">DISSONANCE</a>
  <form class="search" action="catalogo.html">
    <label class="sr-only" for="buscar">Buscar</label>
    <input id="buscar" name="q" placeholder="⌕  Buscar álbumes, artistas..." />
  </form>
  <nav aria-label="Navegación principal"></nav>`;

const PIE = `
  <div>
    <strong>DISSONANCE · TIENDA DE DISCOS</strong>
    <p>Blvd. Riviera Nayarit #200-69, Bahía de Banderas, Nayarit</p>
  </div>
  <div>
    <strong>HORARIO</strong>
    <p>Lunes a sábado</p>
    <p>9:00–16:00 y 17:00–22:00</p>
  </div>
  <div>
    <strong>CONTACTO</strong>
    <p>322 140 1667</p>
  </div>`;

const CARRITO = `<a class="carrito-icono" href="carrito.html" aria-label="Carrito" title="Carrito">
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 7H6"/></svg>
  <span id="num-carrito" class="contador-carrito" style="display:none"></span></a>`;

// Enlaces del menú según quién tenga la sesión iniciada
function menuPara(usuario) {
  if (!usuario) return CARRITO + '<a class="account-link" href="login.html">Iniciar sesión</a>';
  const salir = '<a href="#" data-cerrar-sesion>Cerrar sesión</a>';
  if (usuario.role === 'admin') {
    return '<a href="admin.html">Pedidos</a><a href="admin-albumes.html">Álbumes</a>' + CARRITO + '<a class="account-link" href="mi-cuenta.html">Cuenta</a>' + salir;
  }
  return CARRITO + '<a class="account-link" href="mi-cuenta.html">Mi cuenta</a>' + salir; // ahí están también sus pedidos
}

// Muestra en el icono del carrito cuántos discos hay (nada si está vacío)
function actualizarContadorCarrito() {
  const numero = document.getElementById('num-carrito');
  if (!numero) return; // el menú todavía no se ha dibujado: al dibujarlo se llama otra vez
  const total = leerCarrito().reduce((suma, i) => suma + i.quantity, 0);
  numero.textContent = total;
  numero.style.display = total > 0 ? 'inline-block' : 'none';
}

function iniciarEncabezado() {
  document.querySelector('header.site-header').innerHTML = ENCABEZADO;
  document.querySelector('footer.site-footer').innerHTML = PIE;

  // Accesibilidad: enlace "Saltar al contenido" (para quien navega con el teclado)
  const principal = document.querySelector('main');
  principal.id = 'contenido-principal';
  principal.tabIndex = -1;
  document.body.insertAdjacentHTML('afterbegin', '<a class="saltar" href="#contenido-principal">Saltar al contenido</a>');

  const nav = document.querySelector('.site-header nav');
  nav.style.visibility = 'hidden'; // evita que se vea un instante el menú equivocado
  obtenerUsuario().then((usuario) => {
    nav.innerHTML = menuPara(usuario);
    const actual = location.pathname.split('/').pop() || 'catalogo.html';
    nav.querySelectorAll('a[href]').forEach((a) => {
      if (a.getAttribute('href') === actual) a.setAttribute('aria-current', 'page'); // marca la página en la que estás
    });
    actualizarContadorCarrito();
    nav.style.visibility = 'visible';

    nav.querySelectorAll('[data-cerrar-sesion]').forEach((salir) => {
      salir.addEventListener('click', async (evento) => {
        evento.preventDefault();
        await llamarApi('/api/auth/logout', 'POST');
        localStorage.removeItem(CLAVE_CARRITO); // el carrito no debe pasar a otra cuenta
        window.location.href = 'catalogo.html';
      });
    });
  });
}

iniciarEncabezado();
