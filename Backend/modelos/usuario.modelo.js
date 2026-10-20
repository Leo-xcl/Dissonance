// Cuentas de usuario: registro, inicio de sesión y perfil
const bcrypt = require('bcryptjs');
const db = require('../base-de-datos');
const { falla } = require('./errores');
const { texto } = require('./validar');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function crearUsuario({ nombre, email, telefono, hash, rol = 'customer' }) {
  const r = db
    .prepare('INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(nombre, email, telefono, hash, rol);
  return Number(r.lastInsertRowid);
}

// Incluye el hash: solo se usa para comprobar la contraseña, nunca sale al navegador
function buscarPorEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function buscarPorId(id) {
  return db.prepare('SELECT id, full_name AS name, email, phone, role, created_at FROM users WHERE id = ?').get(id);
}

function validarDatos(d) {
  const nombre = texto(d.name, 2, 100, 'Escribe tu nombre completo.');
  const correo = String(d.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(correo)) throw falla(400, 'Correo electrónico inválido.');
  const telefono = String(d.phone || '').replace(/[\s-]/g, '');
  if (telefono && !/^\d{10}$/.test(telefono)) throw falla(400, 'El teléfono debe tener 10 dígitos.');
  return { nombre, correo, telefono: telefono || null };
}

function validarContrasena(password) {
  if (String(password || '').length < 8) throw falla(400, 'La contraseña debe tener al menos 8 caracteres.');
}

const correoRepetido = () => falla(409, 'Ya existe una cuenta con ese correo.');

async function registrar(datos) {
  const { nombre, correo, telefono } = validarDatos(datos);
  validarContrasena(datos.password);
  if (buscarPorEmail(correo)) throw correoRepetido();
  const hash = await bcrypt.hash(String(datos.password), 10);
  return buscarPorId(crearUsuario({ nombre, email: correo, telefono, hash }));
}

// Mismo mensaje si falla el correo o la contraseña: no revela qué correos existen
async function autenticar(email, password) {
  const usuario = buscarPorEmail(String(email || '').trim().toLowerCase());
  const valido = usuario && (await bcrypt.compare(String(password || ''), usuario.password_hash));
  if (!valido) throw falla(401, 'Correo o contraseña incorrectos.');
  return buscarPorId(usuario.id);
}

// Cambia nombre, correo y teléfono; la contraseña solo si se manda la nueva junto con la actual
async function actualizarPerfil(id, datos) {
  const { nombre, correo, telefono } = validarDatos(datos);
  const otro = buscarPorEmail(correo);
  if (otro && otro.id !== id) throw correoRepetido();

  if (datos.new_password) {
    validarContrasena(datos.new_password);
    const actual = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id);
    if (!(await bcrypt.compare(String(datos.current_password || ''), actual.password_hash))) {
      throw falla(400, 'La contraseña actual no es correcta.');
    }
    const hash = await bcrypt.hash(String(datos.new_password), 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  }
  db.prepare('UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?').run(nombre, correo, telefono, id);
  return buscarPorId(id);
}

module.exports = { crearUsuario, buscarPorEmail, buscarPorId, registrar, autenticar, actualizarPerfil };
