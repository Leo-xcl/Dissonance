const usuarioModelo = require('../modelos/usuario.modelo');
const { falla } = require('../modelos/errores');
const { loginBloqueado, anotarFallo, olvidarFallos } = require('../middlewares/seguridad');

// Al registrarse o entrar solo salen estos datos; nunca el hash de la contraseña
const publico = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// Crea una sesión nueva (regenerate evita reutilizar un id de sesión anterior)
function iniciarSesion(req, res, usuario, estado) {
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'No se pudo iniciar la sesión.' });
    req.session.userId = usuario.id;
    res.status(estado).json(publico(usuario));
  });
}

async function registrar(req, res) {
  const usuario = await usuarioModelo.registrar(req.body);
  iniciarSesion(req, res, usuario, 201);
}

async function entrar(req, res) {
  const clave = `${req.ip}|${String(req.body.email).toLowerCase()}`;
  if (loginBloqueado(clave)) throw falla(429, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
  try {
    const usuario = await usuarioModelo.autenticar(req.body.email, req.body.password);
    olvidarFallos(clave);
    iniciarSesion(req, res, usuario, 200);
  } catch (error) {
    if (error.estado === 401) anotarFallo(clave); // contraseña o correo incorrectos
    throw error;
  }
}

function salir(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
}

// Quién tiene la sesión (lo usa el menú de todas las páginas)
function yo(req, res) {
  res.set('Cache-Control', 'no-store'); // la respuesta depende de quién tenga la sesión
  const usuario = req.session.userId && usuarioModelo.buscarPorId(req.session.userId);
  if (!usuario) return res.status(401).json({ error: 'No has iniciado sesión.' });
  res.json(usuario);
}

async function actualizar(req, res) {
  res.json(await usuarioModelo.actualizarPerfil(req.usuario.id, req.body));
}

module.exports = { registrar, entrar, salir, yo, actualizar };
