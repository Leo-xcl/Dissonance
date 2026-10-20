// Quién está usando la tienda: lee la sesión y protege las rutas y las páginas
const usuarioModelo = require('../modelos/usuario.modelo');

// Devuelve el usuario de la sesión, o null si no ha iniciado sesión
function usuarioActual(req) {
  return req.session.userId ? usuarioModelo.buscarPorId(req.session.userId) : null;
}

// Para rutas públicas que cambian un poco si hay sesión: pone req.usuario (o null) y sigue
function sesionOpcional(req, res, next) {
  req.usuario = usuarioActual(req);
  next();
}

// --- Para rutas de la API: responden con JSON ---
function requiereLogin(req, res, next) {
  req.usuario = usuarioActual(req);
  if (!req.usuario) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  next();
}

function requiereAdmin(req, res, next) {
  req.usuario = usuarioActual(req);
  if (!req.usuario) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  if (req.usuario.role !== 'admin') return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
  next();
}

// --- Para páginas HTML: redirigen en vez de responder JSON ---
function paginaSoloLogueado(req, res, next) {
  if (usuarioActual(req)) return next();
  res.redirect('/login.html');
}

function paginaSoloAdmin(req, res, next) {
  const usuario = usuarioActual(req);
  if (usuario && usuario.role === 'admin') return next();
  res.redirect(usuario ? '/catalogo.html' : '/login.html');
}

module.exports = { sesionOpcional, requiereLogin, requiereAdmin, paginaSoloLogueado, paginaSoloAdmin };
