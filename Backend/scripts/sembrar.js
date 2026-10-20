// Carga el catálogo inicial (datos/catalogo.json) y, con --demo, usuarios, reseñas, solicitudes y pedidos de ejemplo.
// Uso:  npm run sembrar            (solo el catálogo)
//       npm run sembrar -- --demo  (catálogo + datos de ejemplo para ver el panel con movimiento)
// Se puede repetir sin problema: lo que ya existe no se vuelve a crear.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../base-de-datos');
const catalogoAdmin = require('../modelos/catalogo-admin.modelo');
const usuarioModelo = require('../modelos/usuario.modelo');
const resenaModelo = require('../modelos/resena.modelo');
const solicitudModelo = require('../modelos/solicitud.modelo');
const pedidoModelo = require('../modelos/pedido.modelo');
const pedidoAdmin = require('../modelos/pedido-admin.modelo');
const catalogo = require('../datos/catalogo.json');

function sembrarCatalogo() {
  let nuevos = 0;
  for (const a of catalogo) {
    const yaEsta = db
      .prepare('SELECT 1 FROM albums a JOIN artists ar ON ar.id = a.artist_id WHERE a.title = ? AND ar.name = ?')
      .get(a.title, a.artist);
    if (yaEsta) continue;
    catalogoAdmin.guardar(null, {
      title: a.title, artist: a.artist, genre: a.genre, release_year: a.year,
      cover_url: a.cover_url, description: a.description, variants: a.variants,
      tracks: a.tracks.map(([title, segundos]) => ({ title, duration_seconds: segundos })),
    });
    nuevos += 1;
  }
  console.log(`Catálogo: ${nuevos} álbumes nuevos (${catalogo.length} en la lista).`);
}

const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Usuarios, reseñas y pedidos inventados. Las contraseñas de los usuarios de ejemplo son aleatorias: nadie inicia sesión con ellos.
function sembrarDemo() {
  const nombres = ['Ana Torres', 'Luis Ramírez', 'Marta Gómez', 'Pedro Sánchez', 'Sofía Herrera', 'Diego Castillo', 'Valeria Núñez', 'Jorge Mendoza'];
  const usuarios = nombres.map((nombre, i) => {
    const email = `cliente${i + 1}@demo.local`;
    const existente = usuarioModelo.buscarPorEmail(email);
    if (existente) return usuarioModelo.buscarPorId(existente.id);
    const hash = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 10);
    return usuarioModelo.buscarPorId(usuarioModelo.crearUsuario({ nombre, email, telefono: null, hash }));
  });

  const albumes = db.prepare('SELECT id FROM albums WHERE is_active = 1').all();
  // El comentario va de acuerdo con las estrellas (un "Un clásico." nunca sale con 2.5)
  const RESENAS = [
    { estrellas: [4.5, 5], comentarios: ['Un clásico.', 'Suena increíble en vinilo.', ''] },
    { estrellas: [4, 4.5], comentarios: ['Lo escucho toda la semana.', ''] },
    { estrellas: [3, 3.5], comentarios: ['Buen disco, aunque esperaba más.', ''] },
    { estrellas: [2.5], comentarios: ['No es lo mío, pero tiene buenos momentos.', ''] },
  ];
  const PESOS = [0, 0, 0, 1, 1, 2, 3]; // más reseñas buenas que malas
  for (const a of albumes) {
    if (Math.random() < 0.5) continue; // no todos los discos tienen reseñas
    for (const u of usuarios.filter(() => Math.random() < 0.3)) {
      const tipo = RESENAS[elegir(PESOS)];
      resenaModelo.guardar(u, a.id, { rating: elegir(tipo.estrellas), comment: elegir(tipo.comentarios) });
    }
  }

  // Solicitudes de ejemplo: unos cuantos discos pedidos por varias personas, para ver "Más solicitados" en el panel
  for (const a of albumes.filter(() => Math.random() < 0.15)) {
    for (const u of usuarios.filter(() => Math.random() < 0.4)) solicitudModelo.solicitar(u, a.id);
  }

  // Pedidos de ejemplo: se crean con el mismo código real de la tienda (recoger y pagar en caja)
  const variantes = db.prepare('SELECT id FROM album_variants WHERE is_active = 1 AND stock_quantity > 5').all();
  for (let i = 0; i < 25; i++) {
    const u = elegir(usuarios);
    const items = [{ variantId: elegir(variantes).id, quantity: 1 + Math.floor(Math.random() * 2) }];
    const pedido = pedidoModelo.crear(u, {
      delivery: 'pickup', items, contact: { name: u.name, phone: '3221234567' }, payment: { method: 'store' },
    });
    if (Math.random() < 0.8) {
      pedidoAdmin.confirmarPago(pedido.payment_code);
      const avance = elegir(['confirmed', 'preparing', 'ready_for_pickup', 'picked_up']);
      if (avance !== 'confirmed') pedidoAdmin.cambiarEstado(pedido.order_id, avance);
    }
  }
  console.log(`Datos de ejemplo: ${usuarios.length} clientes, reseñas, solicitudes y 25 pedidos.`);
}

sembrarCatalogo();
if (process.argv.includes('--demo')) sembrarDemo();
