// Pago SIMULADO con tarjeta: se revisa que los datos sean creíbles, pero nunca se cobra ni se guarda el número completo
const { falla } = require('./errores');
const { texto } = require('./validar');

// Algoritmo de Luhn: detecta números de tarjeta mal escritos
function luhnValido(numero) {
  let suma = 0;
  let doble = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (doble) { d *= 2; if (d > 9) d -= 9; }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}

function detectarMarca(numero) {
  if (/^4/.test(numero)) return 'Visa';
  if (/^5[1-5]/.test(numero)) return 'Mastercard';
  return 'Tarjeta';
}

// Pago SIMULADO: valida la tarjeta pero NO guarda el número completo ni el CVV. Solo devuelve la marca y los últimos 4 dígitos.
function validarTarjeta(tarjeta) {
  const numero = String(tarjeta.number || '').replace(/[\s-]/g, '');
  texto(tarjeta.holder, 3, 100, 'Escribe el nombre que aparece en la tarjeta.');
  if (!/^\d{16}$/.test(numero) || !luhnValido(numero)) throw falla(400, 'El número de tarjeta no es válido.');

  // Acepta MM/AA, MM/AAAA y también MMAA
  const m = /^(\d{2})\/?(\d{2}|\d{4})$/.exec(String(tarjeta.expiry || '').replace(/\s/g, ''));
  const mes = m ? Number(m[1]) : 0;
  const anio = m ? (m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])) : 0;
  const hoy = new Date();
  if (!m || mes < 1 || mes > 12 || anio * 12 + mes < hoy.getFullYear() * 12 + hoy.getMonth() + 1) {
    throw falla(400, 'La fecha de vencimiento no es válida.');
  }
  if (!/^\d{3}$/.test(String(tarjeta.cvv || ''))) throw falla(400, 'El código de seguridad debe tener 3 dígitos.');
  return { marca: detectarMarca(numero), ultimos4: numero.slice(-4) };
}

module.exports = { validarTarjeta };
