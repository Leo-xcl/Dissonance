// Tabla del catálogo del panel: 20 álbumes a la vez y un buscador por título o artista
const tablaCatalogo = document.getElementById('tabla-catalogo');
const aviso = document.getElementById('aviso-catalogo');
const buscador = document.getElementById('buscar-album');
const verMas = crearVerMas(document.getElementById('ver-mas-admin'), document.getElementById('contador-admin'), 'álbumes', pintarTabla);

let albumes = []; // todos los álbumes que devolvió el servidor (visibles y ocultos)

function estadoDe(a) {
  if (!a.is_active) return 'Oculto';
  return a.stock > 0 ? 'Visible' : 'Sin existencias';
}

function filaAlbum(a) {
  const ocultar = a.is_active ? `<button type="button" class="button secondary" data-ocultar="${a.id}">Ocultar</button>` : '';
  return `<tr><td>#${a.id}</td><td>${escapar(a.title)}</td><td>${escapar(a.artist)}</td><td>${a.stock}</td>
    <td><span class="status ${a.is_active ? '' : 'cancelled'}">${estadoDe(a)}</span></td>
    <td><a href="album-form.html?id=${a.id}">Editar</a> ${ocultar}</td></tr>`;
}

function pintarTabla() {
  const texto = buscador.value.trim().toLowerCase();
  const coinciden = albumes.filter((a) => a.title.toLowerCase().includes(texto) || a.artist.toLowerCase().includes(texto));
  const filas = coinciden.length
    ? verMas.recortar(coinciden).map(filaAlbum).join('')
    : '<tr><td colspan="6" class="muted">Ningún álbum coincide con la búsqueda.</td></tr>';
  tablaCatalogo.innerHTML = `<table><thead><tr><th>Id</th><th>Álbum</th><th>Artista</th><th>Existencias</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>${filas}</tbody></table>`;
}

// Al escribir se vuelve a empezar desde los primeros 20
buscador.addEventListener('input', () => {
  verMas.reiniciar();
  pintarTabla();
});

tablaCatalogo.addEventListener('click', async (e) => {
  const id = e.target.dataset.ocultar;
  if (!id || !confirm('¿Ocultar este álbum del catálogo? Los pedidos anteriores no se afectan.')) return;
  const { ok, datos } = await llamarApi(`/api/admin/albums/${id}`, 'DELETE');
  aviso.textContent = ok ? 'Álbum ocultado.' : (datos.error || 'No se pudo ocultar.');
  if (ok) {
    albumes.find((a) => a.id === Number(id)).is_active = 0; // se actualiza aquí mismo, sin perder la búsqueda
    pintarTabla();
  }
});

async function cargar() {
  const { ok, datos } = await llamarApi('/api/admin/albums');
  if (!ok) {
    tablaCatalogo.innerHTML = '<p class="muted">No se pudo cargar el catálogo. Intenta de nuevo.</p>';
    return;
  }
  albumes = datos;
  pintarTabla();
  if (new URLSearchParams(window.location.search).get('guardado')) aviso.textContent = 'Álbum guardado.';
}

cargar();
