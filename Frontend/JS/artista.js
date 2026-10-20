const contenedor = document.getElementById('contenido-artista');

function mostrarError(texto) {
  contenedor.innerHTML = `<p class="muted">${texto}</p><p><a href="catalogo.html">← Volver al catálogo</a></p>`;
}

function dibujar(a) {
  const anios = a.first_year === a.last_year ? `${a.first_year}` : `${a.first_year}–${a.last_year}`;
  contenedor.innerHTML = `
    <section class="artist-hero panel"><div class="artist-avatar">${escapar(iniciales(a.name))}</div><div>
      <h1>${escapar(a.name)}</h1>
      <p class="eyebrow">${escapar(a.genres.join(' · '))}</p>
      <div class="artist-stats">
        <div><strong>${a.albums.length}</strong><span>${a.albums.length === 1 ? 'Álbum' : 'Álbumes'} en la tienda</span></div>
        <div><strong>${anios}</strong><span>Años de lanzamiento</span></div>
      </div></div></section>
    <div class="section-title"><h2>Discografía</h2></div>
    <section class="album-grid">${a.albums.map(tarjetaAlbum).join('')}</section>`;
}

async function cargar() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return mostrarError('No sabemos qué artista mostrar.');
  const { ok, datos } = await llamarApi(`/api/artists/${encodeURIComponent(id)}`);
  if (!ok) return mostrarError(escapar(datos.error || 'No se pudo cargar el artista.'));
  document.title = `${datos.name} · Dissonance`;
  dibujar(datos);
}

cargar();
