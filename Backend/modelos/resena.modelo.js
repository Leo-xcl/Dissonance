// Reseñas: una por persona y álbum, con calificación de 0.5 a 5 (media estrella)
const db = require('../base-de-datos');
const { falla } = require('./errores');

// Solo el primer nombre y la inicial del apellido: no se publica el nombre completo ni el correo
function nombreCorto(nombreCompleto) {
  const partes = nombreCompleto.split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes[1][0]}.` : partes[0];
}

// usuario puede ser null (visitante): entonces ninguna reseña se marca como "mía"
function listar(idAlbum, usuario) {
  const filas = db
    .prepare(
      `SELECT r.user_id, u.full_name, r.rating, r.comment, r.created_at
         FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.album_id = ? ORDER BY r.id DESC`
    )
    .all(idAlbum);
  return filas.map((r) => ({
    author: nombreCorto(r.full_name),
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    mine: Boolean(usuario) && r.user_id === usuario.id,
  }));
}

// Crea la reseña o, si la persona ya tenía una en ese álbum, la reemplaza
function guardar(usuario, idAlbum, datos) {
  const album = db.prepare('SELECT id FROM albums WHERE id = ? AND is_active = 1').get(idAlbum);
  if (!album) throw falla(404, 'Álbum no encontrado.');

  const calificacion = Number(datos.rating);
  if (!(calificacion >= 0.5 && calificacion <= 5 && Number.isInteger(calificacion * 2))) {
    throw falla(400, 'La calificación va de 0.5 a 5 estrellas.');
  }
  const comentario = String(datos.comment || '').trim();
  if (comentario.length > 500) throw falla(400, 'El comentario puede tener hasta 500 caracteres.');

  const existente = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND album_id = ?').get(usuario.id, idAlbum);
  if (existente) {
    db.prepare("UPDATE reviews SET rating = ?, comment = ?, created_at = datetime('now') WHERE id = ?").run(calificacion, comentario || null, existente.id);
  } else {
    db.prepare('INSERT INTO reviews (user_id, album_id, rating, comment) VALUES (?, ?, ?, ?)').run(usuario.id, idAlbum, calificacion, comentario || null);
  }
}

module.exports = { listar, guardar };
