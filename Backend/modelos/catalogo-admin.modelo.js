// Administración del catálogo: crear, editar y ocultar álbumes (solo para administradores)
const db = require('../base-de-datos');
const { falla } = require('./errores');
const { texto, entero } = require('./validar');

const FORMATOS = ['vinyl', 'cd', 'cassette'];

// Todos los álbumes (visibles u ocultos) con sus existencias, para la tabla del panel
function listar() {
  return db
    .prepare(
      `SELECT a.id, a.title, ar.name AS artist, a.is_active,
              (SELECT COALESCE(SUM(stock_quantity), 0) FROM album_variants WHERE album_id = a.id AND is_active = 1) AS stock
         FROM albums a JOIN artists ar ON ar.id = a.artist_id ORDER BY a.id DESC`
    )
    .all();
}

// Datos para llenar el formulario de edición
function obtenerParaEditar(id) {
  const album = db
    .prepare(
      `SELECT a.id, a.title, ar.name AS artist, g.name AS genre, a.release_year, a.description, a.cover_url
         FROM albums a JOIN artists ar ON ar.id = a.artist_id JOIN genres g ON g.id = a.genre_id WHERE a.id = ?`
    )
    .get(id);
  if (!album) throw falla(404, 'Álbum no encontrado.');
  album.variants = db
    .prepare('SELECT format, price_cents, discount_percent, stock_quantity FROM album_variants WHERE album_id = ? AND is_active = 1')
    .all(id);
  album.tracks = db.prepare('SELECT title, duration_seconds FROM tracks WHERE album_id = ? ORDER BY position').all(id);
  return album;
}

// Revisa y limpia lo que manda el formulario
function validar(d) {
  const titulo = texto(d.title, 1, 150, 'El título debe tener entre 1 y 150 caracteres.');
  const artista = texto(d.artist, 1, 100, 'Escribe el nombre del artista (máximo 100 caracteres).');
  const genero = texto(d.genre, 1, 50, 'Escribe el género (máximo 50 caracteres).');
  const anio = d.release_year === '' || d.release_year === null || d.release_year === undefined
    ? null
    : entero(d.release_year, 1900, 2100, 'El año debe estar entre 1900 y 2100.');

  const portada = String(d.cover_url || '').trim();
  if (portada && (portada.length > 500 || !/^https?:\/\/[^\s"'<>]+$/i.test(portada))) {
    throw falla(400, 'La portada debe ser una URL que empiece con http:// o https://.');
  }
  const descripcion = String(d.description || '').trim();
  if (descripcion.length > 2000) throw falla(400, 'La descripción no puede pasar de 2000 caracteres.');

  const variantes = Array.isArray(d.variants) ? d.variants : [];
  if (variantes.length === 0) throw falla(400, 'Agrega al menos un formato (vinilo, CD o cassette).');
  const formatosVistos = [];
  const variantesOk = variantes.map((v) => {
    if (!FORMATOS.includes(v.format)) throw falla(400, 'Formato no válido.');
    if (formatosVistos.includes(v.format)) throw falla(400, 'No repitas el mismo formato en un álbum.');
    formatosVistos.push(v.format);
    return {
      format: v.format,
      price_cents: entero(v.price_cents, 0, 100000000, 'El precio no es válido.'),
      discount_percent: entero(v.discount_percent || 0, 0, 100, 'El descuento debe estar entre 0 y 100.'),
      stock_quantity: entero(v.stock_quantity, 0, 100000, 'Las existencias deben ser un entero de 0 o más.'),
    };
  });

  const lista = Array.isArray(d.tracks) ? d.tracks : [];
  if (lista.length > 100) throw falla(400, 'Máximo 100 canciones por álbum.');
  const canciones = lista.map((c) => ({
    titulo: texto(c.title, 1, 150, 'Cada canción necesita un título de hasta 150 caracteres.'),
    duracion: c.duration_seconds === null || c.duration_seconds === undefined || c.duration_seconds === ''
      ? null
      : entero(c.duration_seconds, 0, 36000, 'La duración de una canción no es válida.'),
  }));

  return { titulo, artista, genero, anio, portada: portada || null, descripcion: descripcion || null, variantes: variantesOk, canciones };
}

function idDeArtista(nombre) {
  const existente = db.prepare('SELECT id FROM artists WHERE name = ?').get(nombre);
  return existente ? existente.id : db.prepare('INSERT INTO artists (name) VALUES (?)').run(nombre).lastInsertRowid;
}

function idDeGenero(nombre) {
  const existente = db.prepare('SELECT id FROM genres WHERE name = ?').get(nombre);
  return existente ? existente.id : db.prepare('INSERT INTO genres (name) VALUES (?)').run(nombre).lastInsertRowid;
}

// Crea (id = null) o actualiza un álbum. Todo o nada: si algo falla, no queda nada guardado.
function guardar(id, datos) {
  const d = validar(datos);
  return db.transaction(() => {
    const idArtista = idDeArtista(d.artista);
    const idGenero = idDeGenero(d.genero);

    if (id === null) {
      id = db
        .prepare('INSERT INTO albums (title, artist_id, genre_id, release_year, description, cover_url) VALUES (?, ?, ?, ?, ?, ?)')
        .run(d.titulo, idArtista, idGenero, d.anio, d.descripcion, d.portada).lastInsertRowid;
    } else {
      const r = db
        .prepare('UPDATE albums SET title = ?, artist_id = ?, genre_id = ?, release_year = ?, description = ?, cover_url = ?, is_active = 1 WHERE id = ?')
        .run(d.titulo, idArtista, idGenero, d.anio, d.descripcion, d.portada, id);
      if (r.changes === 0) throw falla(404, 'Álbum no encontrado.');
    }

    // Los formatos no se borran (los pedidos los referencian): los que ya no vienen se desactivan
    db.prepare('UPDATE album_variants SET is_active = 0 WHERE album_id = ?').run(id);
    for (const v of d.variantes) {
      const existente = db.prepare('SELECT id FROM album_variants WHERE album_id = ? AND format = ?').get(id, v.format);
      if (existente) {
        db.prepare('UPDATE album_variants SET price_cents = ?, discount_percent = ?, stock_quantity = ?, is_active = 1 WHERE id = ?')
          .run(v.price_cents, v.discount_percent, v.stock_quantity, existente.id);
      } else {
        db.prepare('INSERT INTO album_variants (album_id, format, price_cents, discount_percent, stock_quantity) VALUES (?, ?, ?, ?, ?)')
          .run(id, v.format, v.price_cents, v.discount_percent, v.stock_quantity);
      }
    }

    db.prepare('DELETE FROM tracks WHERE album_id = ?').run(id);
    d.canciones.forEach((c, i) => {
      db.prepare('INSERT INTO tracks (album_id, position, title, duration_seconds) VALUES (?, ?, ?, ?)').run(id, i + 1, c.titulo, c.duracion);
    });
    return Number(id);
  })();
}

// "Eliminar" = ocultar del catálogo; los pedidos pasados conservan su referencia
function ocultar(id) {
  const r = db.prepare('UPDATE albums SET is_active = 0 WHERE id = ?').run(id);
  if (r.changes === 0) throw falla(404, 'Álbum no encontrado.');
}

module.exports = { listar, obtenerParaEditar, guardar, ocultar };
