// Pruebas automáticas de la API. Se ejecutan con:  npm test   (dentro de la carpeta Backend)
//
// Cómo funcionan: antes de las pruebas se crea una base de datos TEMPORAL, se carga el catálogo inicial,
// se crea un administrador y se arranca el servidor en otro puerto. Así nunca se toca la base real.
// Cada prueba hace peticiones HTTP (como lo haría el navegador) y revisa la respuesta.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const catalogo = require('../datos/catalogo.json');

const PUERTO = 3100;
const BASE = `http://localhost:${PUERTO}`;
const CARPETA = path.join(__dirname, '..');
const ARCHIVO_BD = path.join(os.tmpdir(), `dissonance-lite-prueba-${Date.now()}.db`);
const ENTORNO = { ...process.env, BASE_DE_DATOS: ARCHIVO_BD, PUERTO: String(PUERTO) };
let servidor;

// Un "navegador" de mentira: guarda la cookie de sesión entre peticiones
class Cliente {
  constructor() { this.cookie = ''; }
  async pedir(metodo, ruta, cuerpo) {
    const opciones = { method: metodo, headers: {}, redirect: 'manual' };
    if (this.cookie) opciones.headers.Cookie = this.cookie;
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
    const respuesta = await fetch(BASE + ruta, opciones);
    const nueva = respuesta.headers.get('set-cookie');
    if (nueva) this.cookie = nueva.split(';')[0];
    const texto = await respuesta.text();
    let datos = null;
    try { datos = JSON.parse(texto); } catch (error) { datos = null; }
    return { estado: respuesta.status, datos, cabeceras: respuesta.headers };
  }
  get(ruta) { return this.pedir('GET', ruta); }
  post(ruta, cuerpo) { return this.pedir('POST', ruta, cuerpo || {}); }
  put(ruta, cuerpo) { return this.pedir('PUT', ruta, cuerpo || {}); }
  borrar(ruta) { return this.pedir('DELETE', ruta); }
}

const visitante = new Cliente();
const admin = new Cliente();
const ana = new Cliente(); // cliente 1
const beto = new Cliente(); // cliente 2

const TARJETA = { holder: 'Ana Prueba', number: '4242 4242 4242 4242', expiry: '12/39', cvv: '123' };
const CONTACTO = { name: 'Ana Prueba', phone: '3221234567' };
const DOMICILIO = { street: 'Calle Hidalgo 245', neighborhood: 'Centro', postalCode: '63735', city: 'Mezcales' };

// Álbum propio de las pruebas, con existencias y precios conocidos (así no dependen del catálogo inicial)
const ALBUM_PRUEBA = {
  title: 'Disco de Prueba', artist: 'Artista de Prueba', genre: 'Prueba', release_year: 2020,
  variants: [
    { format: 'vinyl', price_cents: 10000, discount_percent: 20, stock_quantity: 3 },
    { format: 'cd', price_cents: 5000, discount_percent: 0, stock_quantity: 0 },
  ],
  tracks: [{ title: 'Tema uno', duration_seconds: 225 }, { title: 'Tema dos', duration_seconds: null }],
};
let albumPrueba; // se llena en la prueba que lo crea

async function registrar(cliente, nombre, correo) {
  return cliente.post('/api/auth/register', { name: nombre, email: correo, phone: '3221234567', password: 'Clave12345' });
}

// Crea un pedido de recoger en tienda del álbum de pruebas (formato vinilo)
async function pedidoEnTienda(cliente, cantidad) {
  const v = albumPrueba.formats.find((f) => f.format === 'vinyl');
  return cliente.post('/api/orders', {
    delivery: 'pickup', contact: CONTACTO, payment: { method: 'store' }, items: [{ variantId: v.id, quantity: cantidad }],
  });
}

async function existenciasVinilo() {
  const detalle = (await visitante.get(`/api/albums/${albumPrueba.id}`)).datos;
  return detalle.formats.find((f) => f.format === 'vinyl').stock_quantity;
}

before(async () => {
  execFileSync('node', ['scripts/sembrar.js'], { cwd: CARPETA, env: ENTORNO });
  execFileSync('node', ['scripts/crear-admin.js', 'admin@prueba.com', 'Clave12345', 'Admin Prueba'], { cwd: CARPETA, env: ENTORNO });
  servidor = spawn('node', ['server.js'], { cwd: CARPETA, env: ENTORNO, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { // esperar a que el servidor responda
    try { await fetch(BASE + '/api/albums/genres'); break; } catch (error) { await new Promise((r) => setTimeout(r, 100)); }
  }
  await admin.post('/api/auth/login', { email: 'admin@prueba.com', password: 'Clave12345' });
  await registrar(ana, 'Ana Prueba', 'ana@prueba.com');
  await registrar(beto, 'Beto Prueba', 'beto@prueba.com');
});

after(async () => {
  servidor.kill();
  await new Promise((resolver) => servidor.once('exit', resolver)); // en Windows el archivo sigue abierto hasta que el servidor termina
  for (const sufijo of ['', '-shm', '-wal']) fs.rmSync(ARCHIVO_BD + sufijo, { force: true });
});

// ---------------------------------------------------------------- Catálogo
test('catálogo: lista todos los álbumes del catálogo inicial', async () => {
  const r = await visitante.get('/api/albums');
  assert.equal(r.estado, 200);
  assert.equal(r.datos.length, catalogo.length);
  assert.ok(r.datos[0].formats.length > 0);
  assert.ok((await visitante.get('/api/albums/genres')).datos.length >= 5);
});

test('catálogo: búsqueda por título y por artista', async () => {
  const primero = catalogo[0];
  const porTitulo = (await visitante.get(`/api/albums?q=${encodeURIComponent(primero.title.toLowerCase())}`)).datos;
  assert.ok(porTitulo.some((a) => a.title === primero.title));
  const porArtista = (await visitante.get(`/api/albums?q=${encodeURIComponent(primero.artist)}`)).datos;
  assert.ok(porArtista.length >= 1 && porArtista.every((a) => a.artist.toLowerCase().includes(primero.artist.toLowerCase()) || a.title.toLowerCase().includes(primero.artist.toLowerCase())));
  assert.equal((await visitante.get('/api/albums?q=zzzzzz')).datos.length, 0);
});

test('catálogo: filtros por género (varios a la vez), formato y orden por precio', async () => {
  const cuantos = (genero) => catalogo.filter((a) => a.genre === genero).length;
  assert.equal((await visitante.get('/api/albums?genre=Rock')).datos.length, cuantos('Rock'));
  assert.equal((await visitante.get('/api/albums?genre=Rock,Jazz')).datos.length, cuantos('Rock') + cuantos('Jazz')); // sirve cualquiera
  const cassettes = (await visitante.get('/api/albums?format=cassette')).datos;
  assert.ok(cassettes.length > 0 && cassettes.every((a) => a.formats.some((f) => f.format === 'cassette' && f.stock_quantity > 0)));
  const baratos = (await visitante.get('/api/albums?sort=price_asc')).datos.map((a) => Math.min(...a.formats.filter((f) => f.stock_quantity > 0).map((f) => f.final_price_cents)));
  const sinAgotados = baratos.filter((p) => Number.isFinite(p));
  assert.deepEqual(sinAgotados, [...sinAgotados].sort((x, y) => x - y));
});

test('detalle: trae canciones, nunca muestra más de 10 existencias y un álbum inexistente da 404', async () => {
  const lista = (await visitante.get('/api/albums')).datos;
  const detalle = (await visitante.get(`/api/albums/${lista[0].id}`)).datos;
  assert.ok(detalle.tracks.length > 0 && detalle.description);
  for (const a of lista) for (const f of a.formats) assert.ok(f.stock_quantity <= 10);
  assert.equal((await visitante.get('/api/albums/999999')).estado, 404);
});

test('artista: su página trae discografía, géneros y años', async () => {
  const album = (await visitante.get('/api/albums')).datos[0];
  const r = await visitante.get(`/api/artists/${album.artist_id}`);
  assert.equal(r.estado, 200);
  assert.equal(r.datos.name, album.artist);
  assert.ok(r.datos.albums.length >= 1 && r.datos.genres.length >= 1);
  assert.ok(r.datos.first_year <= r.datos.last_year);
  assert.equal((await visitante.get('/api/artists/999999')).estado, 404);
});

// ---------------------------------------------------------------- Seguridad y cuentas
test('seguridad: cabeceras y páginas protegidas', async () => {
  const r = await visitante.get('/api/albums');
  assert.equal(r.cabeceras.get('x-content-type-options'), 'nosniff');
  assert.equal(r.cabeceras.get('x-powered-by'), null);
  assert.equal((await visitante.get('/api/auth/me')).estado, 401);
  assert.equal((await visitante.get('/admin.html')).estado, 302); // el visitante rebota al login
  assert.equal((await visitante.get('/pedido.html')).estado, 302);
  assert.equal((await ana.get('/admin.html')).estado, 302); // un cliente no entra al panel
  assert.equal((await admin.get('/admin.html')).estado, 200);

  // Errores habituales: siempre JSON con un mensaje entendible, nunca la página de error de Express
  const noExiste = await visitante.get('/api/no-existe');
  assert.equal(noExiste.estado, 404);
  assert.ok(noExiste.datos.error);
  const jsonRoto = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{malo' });
  assert.equal(jsonRoto.status, 400);
  assert.ok((await jsonRoto.json()).error);
});

test('cuentas: registro con validaciones, correo repetido y login', async () => {
  const mal = new Cliente();
  assert.equal((await mal.post('/api/auth/register', { name: 'X', email: 'no-es-correo', password: '123' })).estado, 400);
  assert.equal((await registrar(mal, 'Ana Otra', 'ana@prueba.com')).estado, 409); // correo repetido
  assert.equal((await mal.post('/api/auth/login', { email: 'ana@prueba.com', password: 'incorrecta1' })).estado, 401);
  const entra = await mal.post('/api/auth/login', { email: 'ana@prueba.com', password: 'Clave12345' });
  assert.equal(entra.estado, 200);
  assert.equal(entra.datos.role, 'customer');
  const yo = (await mal.get('/api/auth/me')).datos;
  assert.equal(yo.email, 'ana@prueba.com');
  assert.equal(JSON.stringify(yo).includes('password'), false); // nunca sale el hash
});

test('cuentas: cambiar datos y contraseña desde Mi cuenta', async () => {
  const cliente = new Cliente();
  await registrar(cliente, 'Carla Prueba', 'carla@prueba.com');
  const perfil = { name: 'Carla Cambiada', email: 'carla@prueba.com', phone: '3229998877' };
  assert.equal((await cliente.put('/api/auth/me', perfil)).datos.name, 'Carla Cambiada');
  assert.equal((await cliente.put('/api/auth/me', { ...perfil, new_password: 'NuevaClave99', current_password: 'mala' })).estado, 400);
  assert.equal((await cliente.put('/api/auth/me', { ...perfil, new_password: 'NuevaClave99', current_password: 'Clave12345' })).estado, 200);
  assert.equal((await new Cliente().post('/api/auth/login', { email: 'carla@prueba.com', password: 'NuevaClave99' })).estado, 200);
});

test('seguridad: después de 8 intentos fallidos el login se bloquea (429)', async () => {
  const atacante = new Cliente();
  for (let i = 0; i < 8; i++) await atacante.post('/api/auth/login', { email: 'victima@prueba.com', password: 'adivinando1' });
  assert.equal((await atacante.post('/api/auth/login', { email: 'victima@prueba.com', password: 'adivinando1' })).estado, 429);
});

test('permisos: el panel solo es para administradores', async () => {
  assert.equal((await visitante.get('/api/admin/summary')).estado, 401);
  assert.equal((await ana.get('/api/admin/summary')).estado, 403);
  assert.equal((await admin.get('/api/admin/summary')).estado, 200);
});

// ---------------------------------------------------------------- Panel: catálogo
test('admin: crear, editar y ocultar un álbum, y validaciones', async () => {
  assert.equal((await admin.post('/api/admin/albums', { ...ALBUM_PRUEBA, variants: [] })).estado, 400); // sin formatos
  assert.equal((await admin.post('/api/admin/albums', { ...ALBUM_PRUEBA, variants: [{ format: 'vinyl', price_cents: -5, stock_quantity: 1 }] })).estado, 400);
  assert.equal((await admin.post('/api/admin/albums', { ...ALBUM_PRUEBA, cover_url: 'javascript:alert(1)' })).estado, 400);
  assert.equal((await ana.post('/api/admin/albums', ALBUM_PRUEBA)).estado, 403);

  const creado = await admin.post('/api/admin/albums', ALBUM_PRUEBA);
  assert.equal(creado.estado, 201);
  const detalle = (await visitante.get(`/api/albums/${creado.datos.id}`)).datos;
  assert.equal(detalle.tracks.length, 2);
  assert.equal(detalle.formats.find((f) => f.format === 'vinyl').final_price_cents, 8000); // 10000 con 20 % de descuento
  albumPrueba = detalle;

  const edicion = { ...ALBUM_PRUEBA, title: 'Disco Editado', variants: [ALBUM_PRUEBA.variants[0]] };
  assert.equal((await admin.put(`/api/admin/albums/${albumPrueba.id}`, edicion)).estado, 200);
  const editado = (await visitante.get(`/api/albums/${albumPrueba.id}`)).datos;
  assert.equal(editado.title, 'Disco Editado');
  assert.equal(editado.formats.length, 1); // el CD se desactivó
  assert.equal((await admin.put(`/api/admin/albums/${albumPrueba.id}`, { ...ALBUM_PRUEBA, variants: ALBUM_PRUEBA.variants })).estado, 200); // el CD vuelve
  albumPrueba = (await visitante.get(`/api/albums/${albumPrueba.id}`)).datos;

  const temporal = (await admin.post('/api/admin/albums', { ...ALBUM_PRUEBA, title: 'Disco Temporal' })).datos.id;
  assert.equal((await admin.borrar(`/api/admin/albums/${temporal}`)).estado, 200);
  assert.equal((await visitante.get(`/api/albums/${temporal}`)).estado, 404); // oculto del catálogo
});

// ---------------------------------------------------------------- Reseñas
test('reseñas: media estrella, una por persona y sin datos privados', async () => {
  const url = `/api/albums/${albumPrueba.id}/reviews`;
  assert.equal((await visitante.post(url, { rating: 4 })).estado, 401);
  assert.equal((await ana.post(url, { rating: 4.7 })).estado, 400);
  assert.equal((await ana.post(url, { rating: 0 })).estado, 400);
  assert.equal((await ana.post(url, { rating: 3.5, comment: 'Bueno' })).estado, 201);
  assert.equal((await ana.post(url, { rating: 4.5, comment: 'Mejor al segundo escucha' })).estado, 201); // reemplaza la anterior
  await beto.post(url, { rating: 5 });

  const lista = (await ana.get(url)).datos;
  assert.equal(lista.length, 2);
  assert.equal(lista.filter((r) => r.mine).length, 1);
  assert.equal(JSON.stringify(lista).includes('@'), false); // no se publica el correo
  const detalle = (await visitante.get(`/api/albums/${albumPrueba.id}`)).datos;
  assert.equal(detalle.rating_avg, 4.8); // (4.5 + 5) / 2 = 4.75, redondeado a 4.8
  assert.equal(detalle.review_count, 2);
});

// ---------------------------------------------------------------- Compra
test('carrito: cotiza con precios reales y avisa lo que no hay', async () => {
  const v = albumPrueba.formats.find((f) => f.format === 'vinyl');
  const cd = albumPrueba.formats.find((f) => f.format === 'cd');
  const r = (await visitante.post('/api/orders/quote', { items: [{ variantId: v.id, quantity: 5 }, { variantId: cd.id, quantity: 1 }, { variantId: 999999, quantity: 1 }] })).datos;
  const vinilo = r.items.find((i) => i.variant_id === v.id);
  assert.equal(vinilo.quantity, 3); // pidió 5, solo hay 3
  assert.equal(vinilo.available, 3); // existencias que ve el público (topadas en 10)
  assert.equal(vinilo.unit_price_cents, 8000);
  assert.equal(r.items.find((i) => i.variant_id === cd.id).unavailable, true); // CD agotado
  assert.equal(r.items.find((i) => i.variant_id === 999999).unavailable, true); // ya no existe
  assert.equal(r.subtotal_cents, 24000);
  assert.equal((await visitante.post('/api/orders/quote', { items: [{ variantId: v.id, quantity: 99 }] })).estado, 400);
});

test('envío: tarifa según el código postal', async () => {
  const envio = async (cp) => (await visitante.get(`/api/orders/shipping?cp=${cp}`)).datos.shipping_cents;
  assert.equal(await envio('63735'), 4500); // donde está la tienda
  assert.equal(await envio('48300'), 7500); // Puerto Vallarta
  assert.equal(await envio('01000'), 12000); // resto del país
});

test('pedido con tarjeta: valida, descuenta existencias, cobra el envío y no guarda datos sensibles', async () => {
  const v = albumPrueba.formats.find((f) => f.format === 'vinyl');
  const base = { delivery: 'shipping', contact: CONTACTO, address: DOMICILIO, items: [{ variantId: v.id, quantity: 1 }] };
  assert.equal((await visitante.post('/api/orders', { ...base, payment: { method: 'card', card: TARJETA } })).estado, 401);
  assert.equal((await ana.post('/api/orders', { ...base, payment: { method: 'card', card: { ...TARJETA, number: '4242 4242 4242 4241' } } })).estado, 400); // Luhn
  assert.equal((await ana.post('/api/orders', { ...base, payment: { method: 'card', card: { ...TARJETA, expiry: '01/20' } } })).estado, 400); // vencida
  assert.equal((await ana.post('/api/orders', { ...base, contact: { name: 'Ana', phone: '123' }, payment: { method: 'store' } })).estado, 400);

  const antes = await existenciasVinilo();
  const r = await ana.post('/api/orders', { ...base, payment: { method: 'card', card: TARJETA } });
  assert.equal(r.estado, 201);
  assert.equal(r.datos.status, 'confirmed');
  assert.equal(r.datos.payment_status, 'paid');
  assert.equal(r.datos.total_cents, 8000 + 4500);
  assert.equal(await existenciasVinilo(), antes - 1);

  const pedido = (await ana.get(`/api/orders/${r.datos.order_id}`)).datos;
  assert.equal(pedido.card_last4, '4242');
  assert.equal(JSON.stringify(pedido).includes('4242424242424242'), false);
  assert.equal('cvv' in pedido, false);
});

test('pedido: no se puede comprar más de lo que hay', async () => {
  const existencias = await existenciasVinilo();
  const r = await pedidoEnTienda(beto, existencias + 1);
  assert.equal(r.estado, 409);
  assert.equal(await existenciasVinilo(), existencias); // no se descontó nada
});

test('pedido en tienda: código de pago, confirmar en caja, estados solo hacia adelante y cancelar devuelve existencias', async () => {
  const antes = await existenciasVinilo();
  const r = await pedidoEnTienda(beto, 1);
  assert.equal(r.estado, 201);
  assert.equal(r.datos.status, 'pending');
  assert.match(r.datos.payment_code, /^DIS-\d+-\d{4}$/);
  const id = r.datos.order_id;
  assert.equal(await existenciasVinilo(), antes - 1);

  assert.equal((await admin.put(`/api/admin/orders/${id}/status`, { status: 'preparing' })).estado, 409); // sin pagar solo se puede cancelar
  assert.equal((await ana.post('/api/admin/orders/confirm-payment', { code: r.datos.payment_code })).estado, 403);
  assert.equal((await admin.post('/api/admin/orders/confirm-payment', { code: 'DIS-0-0000' })).estado, 404);
  assert.equal((await admin.post('/api/admin/orders/confirm-payment', { code: r.datos.payment_code })).estado, 200);
  assert.equal((await admin.post('/api/admin/orders/confirm-payment', { code: r.datos.payment_code })).estado, 409); // ya estaba pagado

  assert.equal((await admin.put(`/api/admin/orders/${id}/status`, { status: 'ready_for_pickup' })).estado, 200);
  assert.equal((await admin.put(`/api/admin/orders/${id}/status`, { status: 'confirmed' })).estado, 409); // no se retrocede
  assert.equal((await admin.put(`/api/admin/orders/${id}/status`, { status: 'delivered' })).estado, 409); // no es de este tipo de entrega

  assert.equal((await admin.put(`/api/admin/orders/${id}/status`, { status: 'cancelled' })).estado, 200);
  assert.equal(await existenciasVinilo(), antes); // las existencias regresaron
  assert.equal((await admin.put(`/api/admin/orders/${id}/status`, { status: 'preparing' })).estado, 409); // un pedido cancelado no cambia
});

test('pedido en tienda: un pedido cancelado sin pagar ya no se puede pagar', async () => {
  const r = await pedidoEnTienda(beto, 1);
  await admin.put(`/api/admin/orders/${r.datos.order_id}/status`, { status: 'cancelled' });
  assert.equal((await admin.post('/api/admin/orders/confirm-payment', { code: r.datos.payment_code })).estado, 409);
});

test('privacidad: cada cliente solo ve sus pedidos; el administrador ve todos', async () => {
  const r = await pedidoEnTienda(ana, 1);
  const id = r.datos.order_id;
  assert.equal((await ana.get(`/api/orders/${id}`)).estado, 200);
  assert.equal((await beto.get(`/api/orders/${id}`)).estado, 404);
  assert.equal((await admin.get(`/api/orders/${id}`)).estado, 200);
  assert.ok((await ana.get('/api/orders')).datos.every((p) => p.id));
  assert.equal((await beto.get('/api/orders')).datos.some((p) => p.id === id), false);
});

test('solicitudes: solo con sesión, una por persona y álbum', async () => {
  const album = (await visitante.get('/api/albums')).datos[0];
  const url = `/api/albums/${album.id}/requests`;
  assert.equal((await visitante.post(url)).estado, 401);
  const primera = await ana.post(url);
  assert.equal(primera.estado, 201);
  assert.equal(primera.datos.new_request, true);
  const repetida = await ana.post(url); // la misma persona otra vez: no se duplica
  assert.equal(repetida.estado, 200);
  assert.equal(repetida.datos.new_request, false);
  assert.equal((await beto.post(url)).estado, 201);
  assert.equal((await ana.post('/api/albums/999999/requests')).estado, 404);
  const pedido = (await admin.get('/api/admin/summary')).datos.most_requested.find((a) => a.title === album.title);
  assert.equal(pedido.requests, 2); // ana y beto
});

test('panel: el resumen trae cifras del mes, más vendidos, más solicitados y stock bajo', async () => {
  const r = (await admin.get('/api/admin/summary')).datos;
  for (const campo of ['sales_cents', 'paid_orders_this_month', 'to_prepare', 'awaiting_payment', 'top_sellers', 'most_requested', 'low_stock']) {
    assert.ok(campo in r, `falta ${campo}`);
  }
  assert.ok(r.sales_cents >= 12500);
  assert.ok(r.top_sellers.length > 0 && r.top_sellers[0].units > 0);
  assert.ok(r.low_stock.every((v) => v.stock_quantity <= 5));
  const pedidos = (await admin.get('/api/admin/orders')).datos;
  assert.ok(pedidos.every((p) => Array.isArray(p.next_statuses)));
  assert.ok(pedidos.every((p) => p.items.length > 0 && p.items[0].title && p.items[0].quantity)); // qué discos lleva cada pedido
});
