// Validaciones que comparten varios modelos. Nunca se confía en lo que manda el navegador.
const { falla } = require('./errores');

// Texto con largo entre min y max (sin espacios sobrantes). Si no cumple, error 400 con el mensaje dado.
function texto(valor, min, max, mensaje) {
  const t = String(valor || '').trim();
  if (t.length < min || t.length > max) throw falla(400, mensaje);
  return t;
}

// Número entero entre min y max. Si no cumple, error 400 con el mensaje dado.
function entero(valor, min, max, mensaje) {
  const n = Number(valor);
  const vacio = valor === '' || valor === null || valor === undefined;
  if (vacio || !Number.isInteger(n) || n < min || n > max) throw falla(400, mensaje);
  return n;
}

module.exports = { texto, entero };
