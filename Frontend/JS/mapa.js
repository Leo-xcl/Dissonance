// Mapa de la sucursal: OpenStreetMap con la biblioteca Leaflet.
// Un pin marca la tienda y, al abrirse, muestra su nombre.
const TIENDA = {
  nombre: 'Dissonance',
  detalle: 'Tienda de discos',
  latitud: 20.7119938,
  longitud: -105.2755246,
};

const cajaMapa = document.getElementById('mapa-tienda');

if (typeof L === 'undefined') {
  // La biblioteca no cargó (por ejemplo, sin internet): se avisa y queda el enlace de abajo
  cajaMapa.innerHTML = '<p class="muted" style="padding:24px">No se pudo cargar el mapa. Usa el enlace "Abrir en Google Maps".</p>';
} else {
  const mapa = L.map(cajaMapa, { scrollWheelZoom: false }).setView([TIENDA.latitud, TIENDA.longitud], 16);
  // scrollWheelZoom desactivado: así la rueda del mouse sigue moviendo la página y no solo el mapa

  // OpenStreetMap exige saber desde qué sitio se piden sus mosaicos (el "Referer"). El resto de la tienda no manda
  // ese dato a otros sitios (ver middlewares/seguridad.js), así que aquí se permite solo para los mosaicos, y solo el origen.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    referrerPolicy: 'strict-origin-when-cross-origin',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  L.marker([TIENDA.latitud, TIENDA.longitud], { title: `${TIENDA.nombre} · ${TIENDA.detalle}` })
    .addTo(mapa)
    .bindPopup(`<strong>${TIENDA.nombre}</strong><br>${TIENDA.detalle}`)
    .openPopup();
}
