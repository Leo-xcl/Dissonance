# Contexto de Dissonance-Mejorado (para continuar en otra conversación)

Última actualización: 17 de octubre de 2026. Leer este archivo completo antes de tocar nada.

> **Esta carpeta es la versión que se entrega.** Se creó copiando `Dissonance-Lite` y recortándola al alcance acordado con el usuario el 17 de oct (ver §0). `Dissonance` (original) y `Dissonance-Lite` quedan como respaldo y no se tocan.

## 0. Alcance acordado (17 oct 2026)
- **Se quedan:** catálogo (búsqueda, géneros múltiples, formato, solo ofertas, orden, "Ver más"), detalle con 3 formatos y canciones, página de artista, carrito, compra (envío por CP o recoger) con tarjeta simulada o pago en tienda, pedido, reseñas con media estrella, Mi cuenta, panel (pedidos y álbumes), **mapa** (el usuario pidió conservarlo) y **descuento por formato desde el formulario del álbum** (el usuario pidió conservarlo).
- **Se quitaron respecto a Lite:** filtro por calificación mínima; "más vendidos" y "stock bajo" del panel (quedan 4 cifras); buscador por columna del panel (queda un solo buscador por álbum o artista); la página `mis-pedidos.html` (su lista ahora está dentro de `mi-cuenta.html`); la marca Mastercard de la serie 2 en la tarjeta simulada.
- **Simplificado:** login y registro comparten los mismos estilos (antes el login tenía su propio juego de clases); el CSS se reescribió sin reglas duplicadas ni muertas; la validación de tarjeta se separó en `modelos/tarjeta.js`; el selector de estrellas pasó de `comun.js` a `resenas.js` (solo lo usan las reseñas).

## 1. Qué es y por qué existe
- Proyecto final individual de **Ingeniería de Software** (estudiante: Leopoldo). Tienda web de discos (vinilo, CD, cassette). Frontend HTML + CSS + JS puro; backend Node.js + Express 5 + SQLite (better-sqlite3), estructura **MVC**.
- **Entrega: martes 20 de octubre de 2026** (congelar el código el 18). En noviembre habrá pruebas y mantenimiento. Faltan: documentación (requisitos, diagramas MVC y de base de datos, diccionario de datos, lista de endpoints, plan de pruebas, limitaciones) y la guía de lectura por flujos.
- Versiones en el Escritorio: `Dissonance` (original, ~6,400 líneas, 15 tablas), `Dissonance-Lite` (~4,500 líneas, 13 páginas) y **esta carpeta** (~4,000 líneas, 12 páginas, 10 tablas, 137 álbumes, 21 pruebas). El usuario quiere terminar el 18 de oct.
- Se redujo porque el usuario sentía el original excesivo e inverosímil para un estudiante en ~3 semanas.

## 2. Reglas del usuario (respetarlas siempre)
- Responder en **español**, paso a paso, claro y sin tecnicismos innecesarios. Usar género neutro/ they: no suponer pronombres.
- Quiere **entender todo el código** y poder explicarlo en vivo. Código simple y legible: **sin `?.`, `??`, SQL dinámico ni `ON CONFLICT`**; sin archivos innecesarios ni código repetido. Comentarios en español, al estilo del resto.
- **Nunca pegar claves ni contraseñas en el chat**; usar variables de entorno o que el usuario las ponga. Las contraseñas que aparecieron en conversaciones anteriores del proyecto original se consideran expuestas.
- **No exponer datos sensibles en el navegador** (nunca hash de contraseña, ni correos de otros usuarios, ni inventario exacto: el público ve existencias topadas en 10).
- **Probar y decir qué se probó y qué no.** No inventar. No recortar funciones sin avisar.
- **IA:** el curso permite IA solo como apoyo. El usuario debe **declararla** y entender el proyecto. **No ayudar a disfrazar** el origen del código ni a decir que lo escribió solo; sí ayudar a redactar una declaración honesta, a estudiar y a defender el proyecto.
- Después de entregar quiere hacer a mano un "Mini Dissonance" con guía (sin que se lo escriban).

## 3. Cómo arrancarla
```bash
cd Backend
npm install              # node_modules ya está copiado, pero conviene
npm run sembrar -- --demo   # catálogo (137 álbumes) + clientes, reseñas y 25 pedidos de ejemplo; repetible
npm run admin -- correo contraseña "Nombre"   # el usuario elige su contraseña
npm start                # http://localhost:3000
npm test                 # 21 pruebas, usa una base temporal en el puerto 3100
```
**Todavía no existe `Backend/dissonance.db`** (no se copió la de Lite): se crea con `npm run sembrar -- --demo`. Las pruebas usan el puerto 3100: si hay un servidor ahí, fallan 11 pruebas. `SESSION_SECRET` es obligatorio solo con `NODE_ENV=production`. Variables para pruebas: `BASE_DE_DATOS` y `PUERTO`.

## 4. Estructura
```
Backend/  server.js · base-de-datos.js · schema.sql (10 tablas)
  modelos/       errores.js, validar.js, tarjeta.js, usuario, album, catalogo-admin, artista, resena, pedido, pedido-admin
  controladores/ autenticacion, album, artista, resena, pedido, admin   (delgados, sin try/catch: Express 5 propaga errores async)
  rutas/         autenticacion, album (+ reseñas), artista, pedido, admin
  middlewares/   autenticacion.js (sesión y permisos), seguridad.js (cabeceras + límite de 8 intentos de login → 429)
  scripts/       sembrar.js, crear-admin.js
  datos/catalogo.json   pruebas/api.test.js
Frontend/  12 HTML · CSS/estilos.css · JS/ (16 archivos)
```
- Cada página carga, **en este orden**: `comun.js` (utilidades) → `encabezado.js` (dibuja header, footer y menú según la sesión; las páginas traen `<header class="site-header wrap"></header>` y `<footer class="site-footer wrap"></footer>` vacíos) → su propio JS. `login.html` solo carga `comun.js` y su script.
- Páginas: catalogo, detalle-album, artista, carrito, pago, pedido (detalle + código de pago en tienda + pasos), login, registro, mi-cuenta (mis pedidos + datos + contraseña), admin (4 cifras + pedidos + confirmar pago), admin-albumes (tabla con un buscador y "Ver más"), album-form.
- Páginas protegidas en `server.js`: admin.html, admin-albumes.html, album-form.html (solo admin); mi-cuenta.html, pedido.html (con sesión).
- Menú del cliente: carrito · Mi cuenta · Cerrar sesión. Menú del admin: Pedidos · Álbumes · carrito · Cuenta · Cerrar sesión.
- Convención: archivos y carpetas del backend en español; tablas, columnas, rutas de API y campos JSON en inglés.

## 5. Decisiones de negocio y de diseño
- **Dinero en centavos** (enteros). Precio final = `floor(precio × (100 − descuento) / 100)`. El descuento es por formato de álbum (`album_variants.discount_percent`), lo cambia el administrador según temporada, sin fechas.
- **Un álbum = un artista y un género** (columnas `artist_id`, `genre_id`). El filtro de géneros del catálogo acepta varios y sirve **cualquiera** (OR). El catálogo se filtra en JS sobre una consulta simple (`todosLosAlbumes`).
- **Formatos:** vinilo, CD, cassette. Detalle del álbum muestra siempre los 3 ("No disponible" si no hay); las tarjetas muestran círculos solo de los disponibles. Los formatos nunca se borran, se desactivan (`is_active`) porque los pedidos los referencian. "Eliminar" álbum = ocultar.
- **Carrito en el navegador** (`localStorage`, clave `dissonance_carrito`, solo `variantId` y `quantity`, máximo 10 por disco). El servidor recalcula precios y existencias (`POST /api/orders/quote`). Se vacía al cerrar sesión.
- **Pedido:** transacción que revalida existencias, las descuenta y guarda copia (título, artista, formato, precio) de cada línea. Tarjeta simulada: Luhn, vencimiento y CVV de 3; **solo se guardan marca y últimos 4**. Pago en tienda: código `DIS-<id>-<4 dígitos>`, **sin vencimiento automático**; el administrador lo captura en caja (o cancela el pedido).
- **Estados:** envío `confirmed → preparing → shipped → delivered`; recoger `confirmed → preparing → ready_for_pickup → picked_up`. Solo hacia adelante (se pueden saltar pasos) o `cancelled`. Un pedido sin pagar solo puede cancelarse. Cancelar devuelve existencias. Terminales: delivered, picked_up, cancelled. No hay tabla de historial: el detalle del pedido dibuja los pasos según el estado actual.
- **Envío:** `calcularEnvio` por código postal: 63700–63799 → $45 (local, Bahía de Banderas, Nayarit; la tienda está en CP 63735); 48000–48999 → $75 (Puerto Vallarta); resto → $120. Recoger: gratis.
- **Reseñas:** una por persona y álbum; calificación 0.5 a 5 en pasos de 0.5 (`REAL`); publicar de nuevo reemplaza. Se muestra solo "Nombre I." (nunca correo).
- **Seguridad:** bcrypt, sesiones en SQLite (`express-session` + `better-sqlite3-session-store`, cookie httpOnly/sameSite lax), `x-powered-by` oculto, cabeceras nosniff / X-Frame-Options DENY / Referrer-Policy same-origin, validación de todo lo que llega, mensaje único para correo o contraseña incorrectos, límite de intentos de login.
- **Tienda:** Blvd. Riviera Nayarit #200-69, Bahía de Banderas, Nayarit; tel. 322 140 1667; lunes a sábado 9:00–16:00 y 17:00–22:00 (texto fijo); coordenadas 20.7119938, -105.2755246. Mapa con Leaflet 1.9.4 (SRI) y OpenStreetMap; `referrerPolicy: 'strict-origin-when-cross-origin'` en los mosaicos (si no, OSM da 403).
- **Servicios externos en el navegador:** portadas de `cdn-images.dzcdn.net` (Deezer), mosaicos de OpenStreetMap, Leaflet desde cdnjs. El servidor no llama a ninguna API externa.
- **Simulado:** pago con tarjeta, precios y existencias de ejemplo, datos de `--demo`.

## 6. API (todas bajo `/api`)
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PUT /auth/me`.
- Catálogo: `GET /albums` (q, genre, artist, format, discounted, sort: new|name|rating|price_asc|price_desc), `GET /albums/genres`, `GET /albums/:id`, `GET /albums/:id/reviews`, `POST /albums/:id/reviews`, `POST /albums/:id/requests` (solicitar el disco; con sesión), `GET /artists/:id`.
- Compra: `POST /orders/quote`, `GET /orders/shipping?cp=`, `POST /orders`, `GET /orders`, `GET /orders/:id` (solo el dueño o un admin).
- Admin: `GET /admin/summary`, `GET /admin/orders`, `PUT /admin/orders/:id/status`, `POST /admin/orders/confirm-payment`, `GET/POST /admin/albums`, `GET/PUT/DELETE /admin/albums/:id`.

## 7. Estado de verificación (17 oct 2026, tras el recorte)
- `npm test`: **20 de 20** (catálogo y filtros, detalle, artista, seguridad y páginas protegidas, cuentas, cambio de contraseña, límite de login, permisos, CRUD de álbumes, reseñas, carrito, envío, pedido con tarjeta, existencias insuficientes, pago en tienda y estados, cancelación, privacidad, resumen).
- Probado en el navegador integrado (servidor temporal, base temporal nueva con `--demo`): catálogo, mapa (cargan los mosaicos), detalle, agregar al carrito, crear cuenta, pago con tarjeta y recoger en tienda, detalle del pedido, Mi cuenta con la lista de pedidos, cerrar sesión, login de admin, 4 cifras del panel, cambiar estado de un pedido, tabla de álbumes, poner 20 % de descuento al vinilo de un álbum y ver el precio rebajado en el detalle, publicar una reseña (clic = 3.5, flecha derecha = 4). Las 12 páginas a 375 px de ancho: sin desplazamiento horizontal.
- **No probado tras el recorte:** pago en tienda y confirmar el código desde la interfaz (sí lo cubren las pruebas automáticas), envío a domicilio desde la interfaz, Chrome del usuario, otros navegadores, lector de pantalla.

- Revisión contra el segundo prompt del usuario (17 oct): sin enlaces rotos ni botones sin acción (todos los `href` existen; cada `getElementById` encuentra su elemento). Se corrigieron dos errores: una ruta `/api/...` inexistente devolvía la página HTML de Express (ahora 404 en JSON) y un JSON mal escrito daba 500 (ahora 400 con mensaje). Ambos quedaron dentro de la prueba "seguridad". Variables de entorno documentadas en README.

- Correcciones tras la prueba del usuario en Chrome (17 oct): (1) **estrellas**: el CSS nuevo había quitado `width: max-content` de `.estrellas`; el cuadro ocupaba todo el ancho y solo se podía elegir 0.5 o 1. Restaurado y probado con clics reales (2, 4 y 5). (2) **descuentos visibles**: `htmlPrecio()` en `comun.js` muestra el precio original tachado, el final y "−20%" en tarjetas y en los tres formatos del detalle; si la rebaja es de un formato que no es el más barato, la tarjeta añade "Vinilo −20%". (3) Ajustes visuales pedidos: `htmlEstrellas()` siempre pone el número al lado ("★★★★☆ 4.0") y `title` al pasar el mouse; la pastilla de "N reseñas" usa su propia clase `.conteo-resenas` (antes `.rating span` también pintaba las estrellas de gris y les ponía borde); la etiqueta de descuento es verde botella (`--verde`); el texto bajo el mapa va centrado. (4) Revisión del usuario: el carrito muestra la portada real (`miniPortada()` en `carrito.js`, `urlPortada()` compartida en `comun.js`); existencias visibles al público con `textoExistencias()` ("Quedan 3" / "10 o más disponibles") en el detalle y el carrito (la cotización ahora devuelve `available`, topado en 10, y el campo de cantidad no deja pasar de ahí); la lista de pedidos del panel trae `items` y muestra la columna "Discos" (cantidad × título y formato); el número de pedido abre su detalle. Probado: cancelar el pedido #23 subió las existencias de 28 a 29.
- **Catálogo ampliado (17 oct):** se agregaron a `datos/catalogo.json` 37 discos de Ghost, Slipknot, Queen, Michael Jackson, Luis Miguel, Cristian Castro y Gojira, copiados de la base del proyecto original (abierta solo para leer). Ya venían de Deezer (portada, año, canciones) con descripción de Wikipedia; precios y existencias simulados del original. Un género por álbum: el primero que exista en la tienda. *The Link* (Gojira) no tenía descripción de Wikipedia: se tomó del artículo "The Link" de es.wikipedia (validado: es el álbum de Gojira). Total: 137 álbumes. Para la base del usuario basta `npm run sembrar` (agrega solo lo nuevo). Ojo: algunos años son de la edición de Deezer, no del lanzamiento original (*The Link* dice 2006, salió en 2003; Queen 2011 por remasterizaciones).
- **Revisión de diseño (17 oct, skill design-critique):** para que no se vea "hecho por IA" se dejaron solo 5 etiquetas pequeñas en mayúsculas (año · género del disco, géneros del artista, tipo de entrega y "Pago en sucursal"); se quitaron las migas falsas ("CATÁLOGO / ÁLBUMES / …", "PANEL / …", "CARRITO / PAGO / CONFIRMACIÓN") y el detalle tiene un enlace real "← Catálogo". DM Sans ahora sí se descarga (`@import` de Google Fonts al inicio de `estilos.css`; antes solo se veía si estaba instalada). Estados y etiquetas de descuento con esquinas de 4 px (solo botones y filtros son píldoras). Textos nuevos en catálogo y carrito.
- **Solicitudes y reportes (17 oct):** para cumplir la problemática de los documentos del curso (catálogo con reservación, **sistema de solicitudes** y **reportes de ventas y demanda**) se agregó la tabla `requests` (una por persona y álbum, como la entidad Solicitud de *Segundo Avance*), `POST /api/albums/:id/requests` (con sesión; 201 nueva, 200 ya existía), el enlace "¿No encuentras el formato que buscas? Solicítalo" en el detalle, y en el panel tres reportes: más vendidos del mes, más solicitados y stock bajo ("Agotado" si es 0). `sembrar --demo` crea solicitudes de ejemplo. 21 pruebas. En la base existente la tabla se crea sola al arrancar (CREATE TABLE IF NOT EXISTS).

## 8. Tamaño (líneas sin blancos ni comentarios)
Servidor 812 · schema 97 · JS frontend ~1,070 · HTML 656 · CSS 976 · pruebas 285 · scripts 76. **Total ~3,970** (presupuesto de la guía: 3,500). 12 páginas, 9 tablas, ~64 archivos (presupuesto: 50). Ningún archivo de código pasa de 200 líneas. El CSS va con una propiedad por renglón; no se comprime a propósito para maquillar la cifra.

## 9. Pendiente / siguientes pasos
1. **El usuario recorre los flujos en su Chrome** (lista en README.md, sección "Cómo comprobar los flujos principales"), sobre todo el pago en tienda y el envío a domicilio.
2. Decidir si se acepta pasarse del presupuesto (~470 líneas y ~14 archivos) o qué más quitar.
3. **Simulacro de examen oral**: empezar por login y compra; el usuario responde con sus palabras y se le corrige.
4. **Guía de lectura por flujos** (hay una versión corta en README.md).
5. **Documentación** (ver §1) y **declaración honesta de uso de IA**.
6. Congelar el 18 de oct: base limpia (sin usuarios reales ni respaldos `.db`), primer commit de git, confirmar `.gitignore` y que ninguna contraseña quede en archivos.
7. Opcional: pedir la rúbrica al profesor; días festivos en el horario; probar en Firefox/Safari y celular.

## 10. Cómo trabajar en esta carpeta
- Antes de cambiar código, leer los archivos implicados. Después de cada cambio: `npm test` y probar la pantalla afectada.
- Para probar con navegador usar un servidor temporal con **copia** de la base (`BASE_DE_DATOS=ruta PUERTO=3400 node server.js`), nunca la base real; borrar la copia al terminar.
- No correr scripts con opciones inventadas sobre la base real (un `--ayuda` inexistente ya insertó datos una vez en el proyecto original).
- Heredocs largos de shell fallan: usar la herramienta de escritura de archivos.
