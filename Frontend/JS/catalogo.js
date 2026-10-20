const contenedor = document.getElementById('lista-albumes');
const chipsGenero = document.getElementById('chips-genero');
const selectFormato = document.getElementById('formato');
const selectOrden = document.getElementById('orden');
const casillaOfertas = document.getElementById('ofertas');
const campoBusqueda = document.getElementById('buscar');
const textoResultado = document.getElementById('resultado-busqueda');

// El estado de los filtros vive en la URL (?q=&genre=Rock,Metal&format=&sort=): se puede compartir y funciona con "atrás"
const params = new URLSearchParams(window.location.search);
let generosElegidos = params.get('genre') ? params.get('genre').split(',') : []; // se pueden elegir varios
const filtros = {
  q: params.get('q') || '',
  format: params.get('format') || '',
  discounted: params.get('discounted') || '',
  sort: params.get('sort') || 'new',
};

let albumes = []; // todos los que devolvió el servidor con los filtros actuales
const verMas = crearVerMas(document.getElementById('ver-mas'), document.getElementById('contador-albumes'), 'álbumes', pintar);

// Los filtros que tengan valor, como parámetros de la dirección (sin el orden)
function paramsFiltros() {
  const p = new URLSearchParams();
  if (generosElegidos.length) p.set('genre', generosElegidos.join(','));
  if (filtros.q) p.set('q', filtros.q);
  if (filtros.format) p.set('format', filtros.format);
  if (filtros.discounted) p.set('discounted', filtros.discounted);
  return p;
}

// Dibuja los primeros 20 álbumes (o los que pida "Ver más")
function pintar() {
  textoResultado.textContent = filtros.q ? `${albumes.length} resultado${albumes.length === 1 ? '' : 's'} para "${filtros.q}"` : '';
  contenedor.innerHTML = albumes.length
    ? verMas.recortar(albumes).map(tarjetaAlbum).join('')
    : '<p class="muted">No encontramos álbumes con esos filtros.</p>';
}

async function cargarCatalogo() {
  const p = paramsFiltros();
  if (filtros.sort !== 'new') p.set('sort', filtros.sort);
  history.replaceState(null, '', p.toString() ? `?${p}` : window.location.pathname);

  const { ok, datos } = await llamarApi(`/api/albums?${p}`);
  if (!ok) {
    contenedor.innerHTML = '<p class="muted">No se pudo cargar el catálogo. Intenta de nuevo.</p>';
    return;
  }
  albumes = datos;
  verMas.reiniciar(); // con cada filtro nuevo se vuelve a empezar desde los primeros 20
  pintar();
}

// ---- Géneros: se pueden elegir varios; el álbum debe tener alguno de los elegidos ("Todo" los borra)
function marcarChips() {
  chipsGenero.querySelectorAll('.chip').forEach((chip) => {
    const nombre = chip.dataset.genero;
    const activo = nombre === '' ? generosElegidos.length === 0 : generosElegidos.includes(nombre);
    chip.classList.toggle('active', activo);
    chip.setAttribute('aria-pressed', activo);
  });
}

function dibujarGeneros(generos) {
  const nombres = [''].concat(generos.map((g) => g.name)); // '' es el chip "Todo"
  chipsGenero.innerHTML = nombres
    .map((n) => `<button type="button" class="chip" data-genero="${escapar(n)}">${n === '' ? 'Todo' : escapar(n)}</button>`)
    .join('');
  marcarChips();
}

chipsGenero.addEventListener('click', (e) => {
  if (!e.target.matches('[data-genero]')) return;
  const genero = e.target.dataset.genero;
  if (genero === '') generosElegidos = [];
  else if (generosElegidos.includes(genero)) generosElegidos = generosElegidos.filter((g) => g !== genero);
  else generosElegidos.push(genero);
  marcarChips();
  cargarCatalogo();
});

// ---- Los demás filtros
selectFormato.addEventListener('change', () => { filtros.format = selectFormato.value; cargarCatalogo(); });
selectOrden.addEventListener('change', () => { filtros.sort = selectOrden.value; cargarCatalogo(); });
casillaOfertas.addEventListener('change', () => { filtros.discounted = casillaOfertas.checked ? '1' : ''; cargarCatalogo(); });

// La búsqueda se hace aquí mismo, sin recargar (el buscador del encabezado también llega con ?q=)
document.querySelector('form.search').addEventListener('submit', (e) => {
  e.preventDefault();
  filtros.q = campoBusqueda.value.trim();
  cargarCatalogo();
});

async function iniciar() {
  campoBusqueda.value = filtros.q;
  selectOrden.value = filtros.sort;
  selectFormato.value = filtros.format;
  casillaOfertas.checked = filtros.discounted === '1';
  const generos = await llamarApi('/api/albums/genres');
  if (generos.ok) dibujarGeneros(generos.datos);
  cargarCatalogo();
}

iniciar();
