// Crea una cuenta de administrador.
// Uso:  npm run admin -- correo@ejemplo.com Contraseña1 Nombre Apellido
const bcrypt = require('bcryptjs');
const usuarioModelo = require('../modelos/usuario.modelo');

const [email, password, ...resto] = process.argv.slice(2);
const nombre = resto.join(' ') || 'Administrador';

if (!email || !password) {
  console.log('Uso: npm run admin -- correo contraseña [nombre]');
  process.exit(1);
}
try {
  usuarioModelo.validarContrasena(password); // la misma regla que en el registro
} catch (error) {
  console.log(error.message);
  process.exit(1);
}

try {
  usuarioModelo.crearUsuario({
    nombre, email: email.toLowerCase(), telefono: null, hash: bcrypt.hashSync(password, 10), rol: 'admin',
  });
  console.log('Administrador creado.');
} catch (error) {
  console.log('No se pudo crear (¿ya existe ese correo?):', error.message);
}
