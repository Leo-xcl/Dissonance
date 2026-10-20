-- Base de datos de Dissonance (SQLite). Se crea sola la primera vez que arranca el servidor.
-- Dinero siempre en CENTAVOS (enteros). Fechas en UTC.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artists (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS genres (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

-- Un álbum tiene un artista y un género. is_active = 0 significa "oculto del catálogo" (nunca se borra: los pedidos lo referencian).
CREATE TABLE IF NOT EXISTS albums (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  artist_id    INTEGER NOT NULL REFERENCES artists(id),
  genre_id     INTEGER NOT NULL REFERENCES genres(id),
  release_year INTEGER,
  description  TEXT,
  cover_url    TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lo que realmente se vende: un álbum en un formato, con su precio y sus existencias
CREATE TABLE IF NOT EXISTS album_variants (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id         INTEGER NOT NULL REFERENCES albums(id),
  format           TEXT NOT NULL CHECK (format IN ('vinyl', 'cd', 'cassette')),
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  stock_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active        INTEGER NOT NULL DEFAULT 1,
  UNIQUE (album_id, format)
);

CREATE TABLE IF NOT EXISTS tracks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id         INTEGER NOT NULL REFERENCES albums(id),
  position         INTEGER NOT NULL,
  title            TEXT NOT NULL,
  duration_seconds INTEGER
);

-- Una reseña por persona y álbum; la calificación va de 0.5 a 5 en pasos de media estrella
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  album_id   INTEGER NOT NULL REFERENCES albums(id),
  rating     REAL NOT NULL CHECK (rating BETWEEN 0.5 AND 5),
  comment    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, album_id)
);

-- Solicitudes: el cliente avisa que quiere un disco que no encuentra (o no en su formato).
-- Le sirven a la tienda para decidir qué comprar. Una por persona y álbum.
CREATE TABLE IF NOT EXISTS requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  album_id   INTEGER NOT NULL REFERENCES albums(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, album_id)
);

-- payment_status: 'pending' (falta pagar) o 'paid'. Un pedido cancelado deja de aceptar pagos.
CREATE TABLE IF NOT EXISTS orders (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id),
  delivery_method       TEXT NOT NULL CHECK (delivery_method IN ('pickup', 'shipping')),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'shipped', 'delivered', 'picked_up', 'cancelled')),
  payment_method        TEXT NOT NULL CHECK (payment_method IN ('card', 'store')),
  payment_status        TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  payment_code          TEXT UNIQUE,
  card_brand            TEXT,
  card_last4            TEXT,
  subtotal_cents        INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents        INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  total_cents           INTEGER NOT NULL CHECK (total_cents >= 0),
  contact_name          TEXT NOT NULL,
  contact_phone         TEXT NOT NULL,
  shipping_street       TEXT,
  shipping_neighborhood TEXT,
  shipping_postal_code  TEXT,
  shipping_city         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Se guarda una copia del título, artista y precio: el pedido no cambia aunque el álbum se edite después
CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id),
  variant_id       INTEGER NOT NULL REFERENCES album_variants(id),
  title_snapshot   TEXT NOT NULL,
  artist_snapshot  TEXT NOT NULL,
  format_snapshot  TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  subtotal_cents   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_variants_album ON album_variants(album_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
