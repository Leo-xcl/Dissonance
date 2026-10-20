// Reseñas del detalle de álbum: lista pública y formulario para quien tiene sesión
const seccion = document.getElementById('seccion-resenas');
const idAlbum = new URLSearchParams(window.location.search).get('id');
const rutaResenas = `/api/albums/${encodeURIComponent(idAlbum)}/reviews`;
let calificacionElegida = 0; // lo que se eligió en las estrellas del formulario

// Estrellas para elegir (como en Letterboxd): al mover el mouse sobre ellas se van llenando de media en media,
// y al hacer clic queda elegido ese valor. "alCambiar" recibe el valor elegido (0.5 a 5).
function crearSelectorEstrellas(caja, valorInicial, alCambiar) {
  let elegido = valorInicial || 0;
  caja.className = 'estrellas estrellas-selector';
  caja.textContent = '★★★★★';
  caja.tabIndex = 0; // se puede usar con el teclado
  caja.setAttribute('role', 'slider');
  caja.setAttribute('aria-label', 'Calificación');
  caja.setAttribute('aria-valuemin', '0.5');
  caja.setAttribute('aria-valuemax', '5');

  function pintar(valor) {
    caja.style.setProperty('--valor', valor);
  }
  // Lo que leen los lectores de pantalla ("3.5 de 5 estrellas")
  function anunciar(valor) {
    caja.setAttribute('aria-valuenow', valor);
    caja.setAttribute('aria-valuetext', valor + ' de 5 estrellas');
  }
  function elegir(valor) {
    elegido = valor;
    anunciar(valor);
    pintar(valor);
    alCambiar(valor);
  }
  // Según en qué parte de las estrellas está el mouse: cada media estrella es un valor
  function valorEn(evento) {
    const medidas = caja.getBoundingClientRect();
    const fraccion = (evento.clientX - medidas.left) / medidas.width;
    return Math.min(5, Math.max(0.5, Math.ceil(fraccion * 10) / 2));
  }

  caja.addEventListener('mousemove', (e) => pintar(valorEn(e)));
  caja.addEventListener('mouseleave', () => pintar(elegido));
  caja.addEventListener('click', (e) => elegir(valorEn(e)));
  caja.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') elegir(Math.min(5, elegido + 0.5));
    if (e.key === 'ArrowLeft') elegir(Math.max(0.5, elegido - 0.5));
  });
  if (elegido) anunciar(elegido);
  pintar(elegido);
}

function htmlResena(r) {
  return `<article class="review"><b>${escapar(r.author)}　${htmlEstrellas(r.rating)}</b>
    <small>${escapar(fechaLocal(r.created_at))}</small>
    ${r.comment ? `<p>${escapar(r.comment)}</p>` : ''}</article>`;
}

function htmlFormulario(usuario, propia) {
  if (!usuario) return '<p class="muted">Para publicar una reseña necesitas <a href="login.html">iniciar sesión</a>.</p>';
  return `<form class="panel form-panel" id="form-resena"><h2>${propia ? 'Edita tu reseña' : 'Deja tu reseña'}</h2>
    <div class="field"><label>Calificación (pasa el mouse y haz clic)</label><div id="selector-calificacion"></div><small class="muted" id="texto-calificacion"></small></div>
    <div class="field"><label for="comentario">Tu opinión</label>
      <textarea id="comentario" rows="4" maxlength="500" placeholder="Cuéntanos qué te pareció el disco...">${propia ? escapar(propia.comment || '') : ''}</textarea></div>
    <button type="submit" class="button primary">${propia ? 'Actualizar reseña' : 'Publicar reseña'}</button>
    <p class="muted" id="aviso-resena" role="status"></p></form>`;
}

// Activa las estrellas del formulario (si hay formulario, es decir, si hay sesión)
function prepararEstrellas(propia) {
  const caja = document.getElementById('selector-calificacion');
  if (!caja) return;
  const texto = document.getElementById('texto-calificacion');
  const mostrar = (valor) => { texto.textContent = valor ? `${valor} de 5` : 'Aún no eliges una calificación'; };
  calificacionElegida = propia ? propia.rating : 0;
  crearSelectorEstrellas(caja, calificacionElegida, (valor) => { calificacionElegida = valor; mostrar(valor); });
  mostrar(calificacionElegida);
}

async function dibujar(resenas) {
  const usuario = await obtenerUsuario();
  const propia = resenas.find((r) => r.mine);
  const promedio = resenas.reduce((suma, r) => suma + r.rating, 0) / resenas.length;
  const resumen = resenas.length
    ? `${htmlEstrellas(promedio)} · ${resenas.length} reseña${resenas.length === 1 ? '' : 's'}`
    : 'Aún sin reseñas';
  seccion.innerHTML = `<div class="section-title"><h2>Reseñas de la comunidad</h2><p class="muted">${resumen}</p></div>
    ${resenas.length ? resenas.map(htmlResena).join('') : '<p class="muted">Sé la primera persona en reseñar este disco.</p>'}
    ${htmlFormulario(usuario, propia)}`;
  prepararEstrellas(propia);
}

seccion.addEventListener('submit', async (e) => {
  e.preventDefault();
  const aviso = document.getElementById('aviso-resena');
  if (!calificacionElegida) { aviso.textContent = 'Elige una calificación con las estrellas.'; return; }
  const { ok, datos } = await llamarApi(rutaResenas, 'POST', {
    rating: calificacionElegida,
    comment: document.getElementById('comentario').value,
  });
  if (!ok) { aviso.textContent = datos.error || 'No se pudo publicar.'; return; }
  await dibujar(datos); // la respuesta ya trae la lista actualizada
  document.getElementById('aviso-resena').textContent = 'Reseña guardada.';
});

async function cargar() {
  const { ok, datos } = await llamarApi(rutaResenas);
  if (ok) dibujar(datos);
  else seccion.innerHTML = '<p class="muted">No se pudieron cargar las reseñas.</p>';
}

cargar();
