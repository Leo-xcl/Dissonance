// Protecciones generales del servidor

// Cabeceras que le piden al navegador ser más estricto
function cabecerasSeguras(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff'); // no "adivinar" el tipo de un archivo
  res.setHeader('X-Frame-Options', 'DENY'); // nadie puede meter la tienda dentro de otra página
  res.setHeader('Referrer-Policy', 'same-origin'); // no mandar la URL a otros sitios
  next();
}

// ---- Límite de intentos fallidos de login ----
// Frena a quien prueba contraseñas una y otra vez. Se guarda en memoria (se reinicia con el servidor).
const MAX_FALLOS = 8;
const VENTANA_MS = 15 * 60 * 1000; // 15 minutos
const fallos = {}; // por ejemplo: { '::1|ana@correo.com': { cuantos: 3, desde: 1700000000000 } }

function loginBloqueado(clave) {
  const registro = fallos[clave];
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA_MS) { // ya pasó el tiempo: se perdona
    delete fallos[clave];
    return false;
  }
  return registro.cuantos >= MAX_FALLOS;
}

function anotarFallo(clave) {
  if (!fallos[clave]) fallos[clave] = { cuantos: 0, desde: Date.now() };
  fallos[clave].cuantos += 1;
}

function olvidarFallos(clave) {
  delete fallos[clave];
}

module.exports = { cabecerasSeguras, loginBloqueado, anotarFallo, olvidarFallos };
