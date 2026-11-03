// Validaciones que comparten varios modelos. Nunca se confía en lo que manda el navegador.
const { falla } = require('./errores');

// Texto con largo entre min y max (sin espacios sobrantes). Si no cumple, error 400 con el mensaje dado.
function texto(valor, min, max, mensaje) {
  const t = String(valor || '').trim();
  if (t.length < min || t.length > max) throw falla(400, mensaje);
  return t;
}

// Número entero entre min y max. Si no cumple, error 400 con el mensaje dado.
// Solo se aceptan dígitos: "1e1" o "2.0" no cuentan, aunque JavaScript sí los convierta a número.
function entero(valor, min, max, mensaje) {
  const t = valor === null || valor === undefined ? '' : String(valor).trim();
  if (!/^\d+$/.test(t)) throw falla(400, mensaje);
  const n = Number(t);
  if (n < min || n > max) throw falla(400, mensaje);
  return n;
}

// Nombre de una persona: de 2 a 100 caracteres, solo letras (con acentos), espacios, punto, apóstrofo y guion
function nombrePersona(valor, mensaje) {
  const t = texto(valor, 2, 100, mensaje);
  if (!/^\p{L}[\p{L} .'-]*$/u.test(t)) throw falla(400, mensaje);
  return t;
}

module.exports = { texto, entero, nombrePersona };
