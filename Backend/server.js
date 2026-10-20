const express = require('express');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const path = require('path');
const db = require('./base-de-datos');
const { paginaSoloAdmin, paginaSoloLogueado } = require('./middlewares/autenticacion');
const { cabecerasSeguras } = require('./middlewares/seguridad');

const app = express();
const PUERTO = process.env.PUERTO || 3000;
const EN_PRODUCCION = process.env.NODE_ENV === 'production';

// En producción el secreto de sesión es obligatorio: con uno conocido cualquiera podría falsificar sesiones
if (EN_PRODUCCION && !process.env.SESSION_SECRET) {
  console.error('Falta la variable de entorno SESSION_SECRET.');
  process.exit(1);
}

app.disable('x-powered-by'); // no anunciar qué tecnología usa el servidor
app.use(cabecerasSeguras);
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  req.body = req.body || {}; // si la petición no trae cuerpo, que sea un objeto vacío y no "undefined"
  next();
});

// Las sesiones se guardan en la base de datos: no se pierden al reiniciar el servidor
app.use(
  session({
    store: new SqliteStore({ client: db }),
    secret: process.env.SESSION_SECRET || 'secreto-de-desarrollo-cambialo',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: EN_PRODUCCION, maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);

// Páginas protegidas: se revisan ANTES de entregar el archivo
app.get(['/admin.html', '/admin-albumes.html', '/album-form.html'], paginaSoloAdmin);
app.get(['/mi-cuenta.html', '/pedido.html'], paginaSoloLogueado);

app.use(express.static(path.join(__dirname, '..', 'Frontend')));

app.use('/api/auth', require('./rutas/autenticacion.rutas'));
app.use('/api/albums', require('./rutas/album.rutas'));
app.use('/api/artists', require('./rutas/artista.rutas'));
app.use('/api/orders', require('./rutas/pedido.rutas'));
app.use('/api/admin', require('./rutas/admin.rutas'));

// Una ruta de la API que no existe responde en JSON, como todas las demás (no con la página de error de Express)
app.use('/api', (req, res) => res.status(404).json({ error: 'Esa dirección de la API no existe.' }));

// Manejador central de errores: todo lo que se lanza en un controlador o modelo llega aquí.
// - Si es un error nuestro (falla, con .estado), se responde con ese estado y su mensaje.
// - Si Express no pudo leer el cuerpo (JSON mal escrito → 400, demasiado grande → 413), se dice que los datos no son válidos.
// - Si es un error inesperado, se responde 500 y el detalle queda solo en la terminal.
app.use((err, req, res, next) => {
  if (err.estado) return res.status(err.estado).json({ error: err.message });
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'Los datos enviados no son válidos.' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PUERTO, () => {
  console.log(`Servidor listo en http://localhost:${PUERTO}`);
});
