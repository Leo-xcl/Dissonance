// Formulario para agregar o editar un álbum (solo administradores)
const idEditar = new URLSearchParams(window.location.search).get('id');
const formulario = document.getElementById('form-album');
const aviso = document.getElementById('aviso-album');
const filasFormatos = document.getElementById('formatos');
const campoCanciones = document.getElementById('canciones');
const campo = (id) => document.getElementById(id);

// Una fila por formato: casilla "lo vendo", precio, existencias y descuento
function filaFormato(formato, variante) {
  const v = variante || { price_cents: '', stock_quantity: '', discount_percent: 0 };
  const fila = document.createElement('div');
  fila.className = 'variant-row';
  fila.dataset.formato = formato;
  fila.innerHTML = `
    <label class="check"><input type="checkbox" data-campo="activo"${variante ? ' checked' : ''}> ${NOMBRE_FORMATO[formato]}</label>
    <label>Precio MXN<input data-campo="precio" type="number" min="0" step="0.01" value="${v.price_cents === '' ? '' : v.price_cents / 100}"></label>
    <label>Existencias<input data-campo="existencias" type="number" min="0" step="1" value="${v.stock_quantity}"></label>
    <label>Descuento %<input data-campo="descuento" type="number" min="0" max="100" step="1" value="${v.discount_percent}"></label>`;
  filasFormatos.appendChild(fila);
}

// "3:45" -> 225. Vacío -> null. Si el texto no es válido se manda tal cual y el servidor lo rechaza.
function aSegundos(texto) {
  if (texto === '') return null;
  const m = /^(\d+):(\d{2})$/.exec(texto);
  return m ? Number(m[1]) * 60 + Number(m[2]) : texto;
}

// Cada renglón "Título | 3:45" se vuelve { title, duration_seconds }
function leerCanciones() {
  return campoCanciones.value
    .split('\n')
    .map((renglon) => renglon.trim())
    .filter(Boolean)
    .map((renglon) => {
      const corte = renglon.lastIndexOf('|');
      if (corte === -1) return { title: renglon, duration_seconds: null };
      return { title: renglon.slice(0, corte).trim(), duration_seconds: aSegundos(renglon.slice(corte + 1).trim()) };
    });
}

// Lee el formulario y arma lo que espera la API (precio en centavos). Solo viajan los formatos marcados.
function leerFormulario() {
  const formatos = [...filasFormatos.querySelectorAll('.variant-row')]
    .filter((f) => f.querySelector('[data-campo=activo]').checked)
    .map((f) => {
      const existencias = f.querySelector('[data-campo=existencias]').value;
      return {
        format: f.dataset.formato,
        price_cents: Math.round(Number(f.querySelector('[data-campo=precio]').value) * 100),
        discount_percent: Number(f.querySelector('[data-campo=descuento]').value) || 0,
        stock_quantity: existencias === '' ? NaN : Number(existencias),
      };
    });
  return {
    title: campo('titulo').value,
    artist: campo('artista').value,
    genre: campo('genero').value,
    release_year: campo('anio').value,
    cover_url: campo('portada').value,
    description: campo('descripcion').value,
    variants: formatos,
    tracks: leerCanciones(),
  };
}

function llenarFormulario(album) {
  campo('titulo-pagina').textContent = 'Editar álbum';
  campo('titulo').value = album.title;
  campo('artista').value = album.artist;
  campo('genero').value = album.genre;
  campo('anio').value = album.release_year || '';
  campo('portada').value = album.cover_url || '';
  campo('descripcion').value = album.description || '';
  campoCanciones.value = album.tracks
    .map((c) => (c.duration_seconds === null ? c.title : `${c.title} | ${duracion(c.duration_seconds)}`))
    .join('\n');
}

async function iniciar() {
  const generos = await llamarApi('/api/albums/genres');
  if (generos.ok) campo('lista-generos').innerHTML = generos.datos.map((g) => `<option value="${escapar(g.name)}">`).join('');

  let album = null;
  if (idEditar) {
    const r = await llamarApi(`/api/admin/albums/${encodeURIComponent(idEditar)}`);
    if (!r.ok) {
      formulario.innerHTML = `<p class="muted">${escapar(r.datos.error || 'No se pudo cargar el álbum.')}</p>`;
      return;
    }
    album = r.datos;
    llenarFormulario(album);
  }
  for (const formato of ['vinyl', 'cd', 'cassette']) {
    filaFormato(formato, album ? album.variants.find((v) => v.format === formato) : null);
  }
}

formulario.addEventListener('submit', async (e) => {
  e.preventDefault();
  aviso.textContent = '';
  const boton = campo('guardar-album');
  boton.disabled = true;
  const ruta = idEditar ? `/api/admin/albums/${encodeURIComponent(idEditar)}` : '/api/admin/albums';
  const { ok, datos } = await llamarApi(ruta, idEditar ? 'PUT' : 'POST', leerFormulario());
  if (ok) {
    window.location.href = 'admin-albumes.html?guardado=1';
    return;
  }
  aviso.textContent = datos.error || 'No se pudo guardar el álbum.';
  boton.disabled = false;
});

iniciar();
