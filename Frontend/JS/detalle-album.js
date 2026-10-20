const contenedor = document.getElementById('contenido-album');
const ORDEN_FORMATOS = ['vinyl', 'cd', 'cassette'];

function mostrarError(mensaje) {
  contenedor.innerHTML = `<p class="muted">${mensaje}</p><p><a href="catalogo.html">← Volver al catálogo</a></p>`;
}

// Siempre se muestran los tres formatos; los que no existen o están agotados salen como "No disponible"
function htmlFormatosElegibles(album, primero) {
  return ORDEN_FORMATOS.map((nombre) => {
    const f = album.formats.find((x) => x.format === nombre);
    if (!f || f.stock_quantity === 0) {
      return `<label class="variant disabled"><input type="radio" name="formato" disabled>
        <span>${NOMBRE_FORMATO[nombre]} · No disponible</span><small>Por el momento</small></label>`;
    }
    const marcado = f.id === primero.id;
    return `<label class="variant${marcado ? ' selected' : ''}">
      <input type="radio" name="formato" value="${f.id}"${marcado ? ' checked' : ''}>
      <span>${NOMBRE_FORMATO[nombre]} · ${htmlPrecio(f)}</span><small>${textoExistencias(f.stock_quantity)}</small></label>`;
  }).join('');
}

function htmlCanciones(canciones) {
  if (canciones.length === 0) return '';
  const total = canciones.reduce((suma, c) => suma + (c.duration_seconds || 0), 0);
  const filas = canciones.map((c) => `<li><span>${escapar(c.title)}</span><small>${duracion(c.duration_seconds)}</small></li>`).join('');
  return `<section class="content-section"><div class="section-title"><h2>Lista de canciones</h2>
    <p class="muted">${canciones.length} canciones${total ? ' · ' + duracion(total) : ''}</p></div>
    <ol class="tracklist">${filas}</ol></section>`;
}

function dibujarAlbum(album) {
  const primero = album.formats.find((f) => f.stock_quantity > 0);
  contenedor.innerHTML = `
    <p><a href="catalogo.html">← Catálogo</a></p>
    <section class="album-detail">
      ${htmlPortada(album, 'detail-cover')}
      <div>
        <p class="eyebrow">${[album.release_year, escapar(album.genre)].filter(Boolean).join(' · ')}</p>
        <h1 class="serif">${escapar(album.title)}</h1>
        <p class="artist-link"><a href="artista.html?id=${album.artist_id}">${escapar(album.artist)}</a></p>
        <p class="muted">${escapar(album.description || 'Descripción disponible próximamente.')}</p>
        <h2>Formatos</h2>
        <div class="variant-grid">${htmlFormatosElegibles(album, primero)}</div>
        <h2 id="precio-vigente">${primero ? 'Precio vigente · ' + htmlPrecio(primero) : 'Sin existencias por ahora'}</h2>
        <div class="button-row">
          <button type="button" class="button primary" id="btn-carrito"${primero ? '' : ' disabled'}>Agregar al carrito</button>
        </div>
        <p class="muted">Disponible para envío o recolección en tienda.</p>
        <p class="muted" id="aviso-carrito" role="status"></p>
        <p class="muted" id="caja-solicitud" role="status"></p>
      </div>
    </section>${htmlCanciones(album.tracks)}`;
  prepararSolicitud(album.id);

  document.getElementById('btn-carrito').addEventListener('click', () => {
    const marcado = contenedor.querySelector('input[name="formato"]:checked');
    agregarAlCarrito(Number(marcado.value));
    document.getElementById('aviso-carrito').innerHTML = 'Agregado al carrito. <a href="carrito.html">Ver carrito</a>';
    actualizarContadorCarrito();
  });

  // Al elegir otro formato se actualiza el precio y la casilla marcada
  contenedor.querySelectorAll('input[name="formato"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const f = album.formats.find((x) => x.id === Number(radio.value));
      contenedor.querySelectorAll('.variant').forEach((l) => l.classList.remove('selected'));
      radio.closest('.variant').classList.add('selected');
      document.getElementById('precio-vigente').innerHTML = 'Precio vigente · ' + htmlPrecio(f); // htmlPrecio solo lleva números del servidor
    });
  });
}

// "¿No encuentras el formato que buscas? Solicítalo": la tienda ve en su panel qué discos le piden más.
// Solo con sesión, para contar una solicitud por persona.
async function prepararSolicitud(idAlbum) {
  const caja = document.getElementById('caja-solicitud');
  const usuario = await obtenerUsuario();
  if (!usuario) {
    caja.innerHTML = '¿No encuentras el formato que buscas? <a href="login.html">Inicia sesión</a> para solicitarlo.';
    return;
  }
  caja.innerHTML = '¿No encuentras el formato que buscas? <a href="#" id="btn-solicitar">Solicítalo</a>';
  document.getElementById('btn-solicitar').addEventListener('click', async (evento) => {
    evento.preventDefault();
    const { ok, datos } = await llamarApi(`/api/albums/${idAlbum}/requests`, 'POST');
    if (!ok) caja.textContent = datos.error || 'No se pudo guardar tu solicitud.';
    else if (datos.new_request) caja.textContent = 'Anotamos tu solicitud. La tienda la toma en cuenta para sus próximas compras.';
    else caja.textContent = 'Ya tenías este disco solicitado.';
  });
}

async function cargarAlbum() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return mostrarError('No se indicó qué álbum mostrar.');
  const { ok, datos } = await llamarApi(`/api/albums/${encodeURIComponent(id)}`);
  if (!ok) return mostrarError(escapar(datos.error || 'No se pudo cargar el álbum.'));
  document.title = datos.title + ' · Dissonance';
  dibujarAlbum(datos);
}

cargarAlbum();
