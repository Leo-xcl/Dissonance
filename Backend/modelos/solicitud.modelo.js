// Solicitudes: los clientes avisan qué discos quieren encontrar en la tienda (la demanda que no se ve en las ventas)
const db = require('../base-de-datos');
const { falla } = require('./errores');

// Registra la solicitud. Si la persona ya había pedido ese disco no se duplica: se le dice que ya estaba.
function solicitar(usuario, idAlbum) {
  const album = db.prepare('SELECT id FROM albums WHERE id = ? AND is_active = 1').get(idAlbum);
  if (!album) throw falla(404, 'Álbum no encontrado.');
  const existente = db.prepare('SELECT id FROM requests WHERE user_id = ? AND album_id = ?').get(usuario.id, idAlbum);
  if (existente) return { nueva: false };
  db.prepare('INSERT INTO requests (user_id, album_id) VALUES (?, ?)').run(usuario.id, idAlbum);
  return { nueva: true };
}

// Los discos más pedidos, para el panel del administrador
function masSolicitados(limite) {
  return db
    .prepare(
      `SELECT al.title, ar.name AS artist, COUNT(*) AS requests
         FROM requests r JOIN albums al ON al.id = r.album_id JOIN artists ar ON ar.id = al.artist_id
        GROUP BY al.id ORDER BY requests DESC, al.title LIMIT ?`
    )
    .all(limite);
}

module.exports = { solicitar, masSolicitados };
