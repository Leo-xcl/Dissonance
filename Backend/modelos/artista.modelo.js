// Página de artista: su información y su discografía en la tienda
const db = require('../base-de-datos');
const { falla } = require('./errores');
const albumModelo = require('./album.modelo');

function obtener(id) {
  const artista = db.prepare('SELECT id, name FROM artists WHERE id = ?').get(id);
  if (!artista) throw falla(404, 'Artista no encontrado.');

  artista.albums = albumModelo.listar({ artist: id, sort: 'new' });
  if (artista.albums.length === 0) throw falla(404, 'Artista no encontrado.');
  artista.genres = [...new Set(artista.albums.map((a) => a.genre))];
  const anios = artista.albums.map((a) => a.release_year).filter(Boolean);
  artista.first_year = anios.length ? Math.min(...anios) : null;
  artista.last_year = anios.length ? Math.max(...anios) : null;
  return artista;
}

module.exports = { obtener };
