// Error de regla de negocio: el manejador central de server.js lo convierte en una respuesta HTTP
function falla(estado, mensaje) {
  const e = new Error(mensaje);
  e.estado = estado;
  return e;
}

module.exports = { falla };
