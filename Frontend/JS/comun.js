// Utilidades que comparten varias páginas. Cada página carga primero comun.js, luego encabezado.js y al final su propio archivo.
const API = '';
const NOMBRE_FORMATO = { vinyl: 'Vinilo', cd: 'CD', cassette: 'Cassette' };
const COLORES_PORTADA = ['teal', 'purple', 'olive', 'rust', 'blue'];

// Nombres en español de los valores que guarda la base (que están en inglés)
const NOMBRE_ESTADO = {
  pending: 'Pendiente de pago',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready_for_pickup: 'Listo para recoger',
  shipped: 'Enviado',
  delivered: 'Entregado',
  picked_up: 'Recogido',
  cancelled: 'Cancelado',
};
const NOMBRE_ENTREGA = { shipping: 'Envío a domicilio', pickup: 'Recoger en tienda' };

// Pasos de cada tipo de entrega, en orden (los mismos que valida el servidor)
const FLUJO_PEDIDO = {
  shipping: ['confirmed', 'preparing', 'shipped', 'delivered'],
  pickup: ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up'],
};

// Convierte texto en HTML seguro (evita que un título con < o & rompa la página)
function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// La base guarda centavos; aquí se muestran como pesos (sin decimales si el precio es redondo)
function pesos(centavos) {
  const decimales = centavos % 100 === 0 ? 0 : 2;
  return '$' + (centavos / 100).toLocaleString('es-MX', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + ' MXN';
}

// La base guarda fechas en UTC ("2026-10-07 15:30:00"); aquí se muestran en hora local
function fechaLocal(fechaUtc) {
  const fecha = new Date(fechaUtc.replace(' ', 'T') + 'Z');
  return fecha.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

// 225 segundos se muestran como "3:45"
function duracion(segundos) {
  if (segundos === null || segundos === undefined) return '';
  return Math.floor(segundos / 60) + ':' + String(segundos % 60).padStart(2, '0');
}

// Clase CSS del distintivo de estado de un pedido
function claseEstado(estado) {
  if (['shipped', 'ready_for_pickup'].includes(estado)) return 'shipped';
  return estado === 'cancelled' ? 'cancelled' : '';
}

// ---------------------------------------------------------------- Sesión y llamadas a la API

// Llama a la API y devuelve { ok, datos } sin lanzar error, ni si el servidor responde 4xx/5xx ni si no hay conexión.
// Si la sesión expiró (401) manda al inicio de sesión (menos al iniciar sesión, donde 401 es "contraseña incorrecta").
async function llamarApi(ruta, metodo = 'GET', cuerpo) {
  const opciones = { method: metodo };
  if (cuerpo !== undefined) {
    opciones.headers = { 'Content-Type': 'application/json' };
    opciones.body = JSON.stringify(cuerpo);
  }
  try {
    const respuesta = await fetch(API + ruta, opciones);
    if (respuesta.status === 401 && ruta !== '/api/auth/login') window.location.href = 'login.html';
    const datos = await respuesta.json().catch(() => ({}));
    return { ok: respuesta.ok, datos };
  } catch (error) {
    console.error(error);
    return { ok: false, datos: { error: 'No se pudo conectar con el servidor.' } };
  }
}

// Quién tiene la sesión: el usuario, o null si es visitante. Se pregunta al servidor una sola vez por página.
let promesaUsuario = null;
function obtenerUsuario() {
  if (!promesaUsuario) {
    promesaUsuario = fetch(API + '/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return promesaUsuario;
}

// ---------------------------------------------------------------- Carrito
// Vive en el navegador y guarda QUÉ y CUÁNTOS; los precios y las existencias los calcula el servidor.
const CLAVE_CARRITO = 'dissonance_carrito';

function leerCarrito() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_CARRITO));
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    return [];
  }
}

function guardarCarrito(items) {
  localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items));
}

function agregarAlCarrito(variantId) {
  const items = leerCarrito();
  const existente = items.find((i) => i.variantId === variantId);
  if (existente) existente.quantity = Math.min(existente.quantity + 1, 10);
  else items.push({ variantId, quantity: 1 });
  guardarCarrito(items);
}

// ---------------------------------------------------------------- Piezas de pantalla que se repiten

function iniciales(titulo) {
  return titulo.split(/\s+/).map((p) => p[0]).join('').slice(0, 3).toUpperCase();
}

function colorPortada(idAlbum) {
  return COLORES_PORTADA[(idAlbum - 1) % COLORES_PORTADA.length];
}

// Las portadas traen su tamaño dentro de la URL (1000x1000); se pide una de 500 y la página carga más rápido.
function urlPortada(url) {
  return url.replace('1000x1000', '500x500');
}

// Lo que se le dice al público de las existencias (el servidor ya las topa en 10)
function textoExistencias(cantidad) {
  if (cantidad >= 10) return '10 o más disponibles';
  return cantidad === 1 ? 'Queda 1' : `Quedan ${cantidad}`;
}

// Portada de un álbum: la imagen si hay URL, y si no una portada de color con las iniciales.
function htmlPortada(album, clase) {
  if (album.cover_url) {
    return `<span class="cover cover-img-box ${clase}"><img class="cover-img" src="${escapar(urlPortada(album.cover_url))}" alt="Portada de ${escapar(album.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
  }
  return `<span class="cover cover-${colorPortada(album.id)} ${clase}"><span>DISSONANCE</span><b>${escapar(iniciales(album.title))}</b><small>SIDE A · ${album.release_year || ''}</small></span>`;
}

// Los formatos con existencias, como círculos pequeños (V, CD, C)
function htmlFormatos(formatos) {
  const etiqueta = { vinyl: 'V', cd: 'CD', cassette: 'C' };
  const circulos = formatos
    .filter((f) => f.stock_quantity > 0)
    .map((f) => `<span class="formato-punto" title="${NOMBRE_FORMATO[f.format]}">${etiqueta[f.format]}</span>`)
    .join('');
  return circulos ? `<div class="formatos" aria-label="Formatos disponibles">${circulos}</div>` : '';
}

// Estrellas de solo lectura con su número al lado ("★★★★☆ 4.0"). El valor puede tener medias estrellas (3.5);
// el relleno lo hace el CSS con la variable --valor. Al pasar el mouse se lee "4 de 5 estrellas".
function htmlEstrellas(valor) {
  const numero = Number(valor) || 0;
  return `<span class="estrellas" style="--valor:${numero}" role="img" title="${numero} de 5 estrellas" aria-label="${numero} de 5 estrellas">★★★★★</span> <b class="valor-estrellas">${numero.toFixed(1)}</b>`;
}

// Precio de un formato. Si tiene descuento: el precio original tachado, el precio final y la etiqueta "−20%"
function htmlPrecio(formato) {
  const final = pesos(formato.final_price_cents);
  if (formato.discount_percent === 0) return final;
  return `<s class="precio-original">${pesos(formato.price_cents)}</s> ${final} <span class="etiqueta-descuento">−${formato.discount_percent}%</span>`;
}

// Tarjeta del catálogo (la usan el catálogo y la página de artista)
function tarjetaAlbum(album) {
  const enlace = `detalle-album.html?id=${album.id}`;
  const conStock = album.formats.filter((f) => f.stock_quantity > 0);
  // El formato más barato entre los que hay (undefined si el álbum está agotado)
  const masBarato = conStock.reduce((a, b) => (b.final_price_cents < a.final_price_cents ? b : a), conStock[0]);
  const precio = masBarato ? 'Desde ' + htmlPrecio(masBarato) : 'Sin existencias';
  // Si la rebaja es de otro formato (p. ej. el vinilo), también se avisa en la tarjeta
  const otraOferta = masBarato && masBarato.discount_percent === 0 && conStock.find((f) => f.discount_percent > 0);
  const avisoOferta = otraOferta ? ` <span class="etiqueta-descuento">${NOMBRE_FORMATO[otraOferta.format]} −${otraOferta.discount_percent}%</span>` : '';
  const calificacion = album.review_count > 0
    ? `<div class="rating">${htmlEstrellas(album.rating_avg)} <span class="conteo-resenas">${album.review_count} reseña${album.review_count === 1 ? '' : 's'}</span></div>`
    : '';
  return `<article class="album-card">
    <a href="${enlace}" class="cover-link" tabindex="-1" aria-hidden="true">${htmlPortada(album, '')}</a>
    <div class="album-info">
      <h3><a href="${enlace}">${escapar(album.title)}</a></h3>
      <p>${escapar(album.artist)}</p>${calificacion}
      <strong>${precio}</strong>${avisoOferta}
      ${htmlFormatos(album.formats)}
    </div></article>`;
}

// "Ver más": muestra una lista de 20 en 20. El botón y el contador ya están en el HTML.
//   const verMas = crearVerMas(boton, contador, 'álbumes', pintar);
//   verMas.recortar(lista) -> los que se deben dibujar ahora (y actualiza el botón y el contador)
//   verMas.reiniciar()     -> vuelve a los primeros 20 (se usa al cambiar un filtro)
function crearVerMas(boton, contador, nombrePlural, redibujar) {
  const POR_PAGINA = 20;
  let mostrados = POR_PAGINA;
  boton.addEventListener('click', () => {
    mostrados += POR_PAGINA;
    redibujar();
  });
  return {
    reiniciar() {
      mostrados = POR_PAGINA;
    },
    recortar(lista) {
      const restantes = lista.length - mostrados;
      boton.style.display = restantes > 0 ? 'inline-flex' : 'none';
      boton.textContent = `Ver más (${Math.min(POR_PAGINA, restantes)} más)`;
      contador.textContent = lista.length ? `Mostrando ${Math.min(mostrados, lista.length)} de ${lista.length} ${nombrePlural}` : '';
      return lista.slice(0, mostrados);
    },
  };
}
