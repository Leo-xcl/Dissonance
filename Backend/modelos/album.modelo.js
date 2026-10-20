// Catálogo público: lo que ve cualquier visitante de la tienda
const db = require('../base-de-datos');
const { falla } = require('./errores');

const STOCK_VISIBLE_MAX = 10; // al público no se le muestra el inventario exacto, solo "hasta 10"

// Precio con descuento, en centavos enteros (se redondea hacia abajo)
function precioFinal(precioCents, descuento) {
  return Math.floor((precioCents * (100 - descuento)) / 100);
}

// Los formatos que se venden de un álbum, con precio final y existencias visibles
function formatoPublico(v) {
  return {
    id: v.id, // el carrito guarda este id para saber qué formato se eligió
    format: v.format,
    price_cents: v.price_cents,
    discount_percent: v.discount_percent,
    final_price_cents: precioFinal(v.price_cents, v.discount_percent),
    stock_quantity: Math.min(v.stock_quantity, STOCK_VISIBLE_MAX),
  };
}

// Consulta simple: todos los álbumes visibles con su artista, género y calificación promedio
function todosLosAlbumes() {
  const albumes = db
    .prepare(
      `SELECT a.id, a.title, a.release_year, a.cover_url, a.artist_id, ar.name AS artist, g.name AS genre,
              (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE album_id = a.id) AS rating_avg,
              (SELECT COUNT(*) FROM reviews WHERE album_id = a.id) AS review_count
         FROM albums a JOIN artists ar ON ar.id = a.artist_id JOIN genres g ON g.id = a.genre_id
        WHERE a.is_active = 1`
    )
    .all();
  const variantes = db
    .prepare('SELECT id, album_id, format, price_cents, discount_percent, stock_quantity FROM album_variants WHERE is_active = 1 ORDER BY id')
    .all();
  for (const a of albumes) a.variants = variantes.filter((v) => v.album_id === a.id);
  return albumes;
}

// El precio más bajo entre los formatos con existencias; null si el álbum está agotado
function precioDesde(album) {
  const precios = album.variants.filter((v) => v.stock_quantity > 0).map((v) => precioFinal(v.price_cents, v.discount_percent));
  return precios.length ? Math.min(...precios) : null;
}

// Ordena por precio (direccion 1 = de menor a mayor, -1 = de mayor a menor); los agotados siempre van al final
function porPrecio(direccion) {
  return (a, b) => {
    const pa = precioDesde(a);
    const pb = precioDesde(b);
    if (pa === null || pb === null) return (pa === null ? 1 : 0) - (pb === null ? 1 : 0);
    return direccion * (pa - pb);
  };
}

const ORDENES = {
  new: (a, b) => b.id - a.id,
  name: (a, b) => a.title.localeCompare(b.title),
  rating: (a, b) => (b.rating_avg || 0) - (a.rating_avg || 0),
  price_asc: porPrecio(1),
  price_desc: porPrecio(-1),
};

// Filtros opcionales: q (texto), genre (varios separados por coma: sirve cualquiera), artist (id),
// format, discounted ('1'), sort.
function listar(filtros) {
  const texto = String(filtros.q || '').trim().toLowerCase();
  const generos = String(filtros.genre || '').split(',').filter(Boolean).map((g) => g.toLowerCase());
  const formato = String(filtros.format || '');

  const resultado = todosLosAlbumes().filter((a) => {
    const conStock = a.variants.filter((v) => v.stock_quantity > 0);
    if (texto && !a.title.toLowerCase().includes(texto) && !a.artist.toLowerCase().includes(texto)) return false;
    if (generos.length && !generos.includes(a.genre.toLowerCase())) return false;
    if (filtros.artist && a.artist_id !== Number(filtros.artist)) return false;
    if (formato && !conStock.some((v) => v.format === formato)) return false;
    if (filtros.discounted === '1' && !conStock.some((v) => v.discount_percent > 0)) return false;
    return true;
  });

  resultado.sort(ORDENES[filtros.sort] || ORDENES.new);
  return resultado.map((a) => ({
    id: a.id, title: a.title, artist: a.artist, artist_id: a.artist_id, genre: a.genre,
    release_year: a.release_year, cover_url: a.cover_url, rating_avg: a.rating_avg, review_count: a.review_count,
    formats: a.variants.map(formatoPublico),
  }));
}

function obtener(id) {
  const album = db
    .prepare(
      `SELECT a.id, a.title, a.release_year, a.description, a.cover_url, a.artist_id, ar.name AS artist, g.name AS genre,
              (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE album_id = a.id) AS rating_avg,
              (SELECT COUNT(*) FROM reviews WHERE album_id = a.id) AS review_count
         FROM albums a JOIN artists ar ON ar.id = a.artist_id JOIN genres g ON g.id = a.genre_id
        WHERE a.id = ? AND a.is_active = 1`
    )
    .get(id);
  if (!album) throw falla(404, 'Álbum no encontrado.');
  album.formats = db
    .prepare('SELECT id, format, price_cents, discount_percent, stock_quantity FROM album_variants WHERE album_id = ? AND is_active = 1 ORDER BY id')
    .all(id)
    .map(formatoPublico);
  album.tracks = db.prepare('SELECT title, duration_seconds FROM tracks WHERE album_id = ? ORDER BY position').all(id);
  return album;
}

function listarGeneros() {
  return db
    .prepare(
      `SELECT g.name FROM genres g
        WHERE EXISTS (SELECT 1 FROM albums a WHERE a.genre_id = g.id AND a.is_active = 1) ORDER BY g.name`
    )
    .all();
}

module.exports = { STOCK_VISIBLE_MAX, precioFinal, listar, obtener, listarGeneros };
