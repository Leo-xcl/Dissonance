# Dissonance

Tienda de discos (vinilo, CD y cassette) con frontend en HTML + CSS + JavaScript puro y backend en Node.js + Express + SQLite, con estructura MVC.

## Cómo arrancarla

Necesitas Node.js 20 o más nuevo. Desde la carpeta `Backend`:

```bash
npm install
npm run sembrar -- --demo
npm run admin -- tu@correo.com TuContraseña1 "Tu Nombre"
npm start
```

Abre http://localhost:3000.

- `npm run sembrar` carga el catálogo (137 álbumes). Con `-- --demo` agrega además clientes, reseñas y pedidos de ejemplo para que el panel tenga movimiento. Se puede repetir sin duplicar nada.
- `npm run admin` crea una cuenta de administrador con el correo y la contraseña que tú elijas (mínimo 8 caracteres).
- `npm test` corre las 21 pruebas automáticas con una base de datos temporal (no toca la tuya). Usan el puerto 3100: no tengas otro servidor en ese puerto mientras corren.
- La base de datos se crea sola al arrancar: `base-de-datos.js` ejecuta `schema.sql` (todas las tablas con `CREATE TABLE IF NOT EXISTS`, claves foráneas y reglas `CHECK`). Así el esquema es reproducible sin herramientas de migraciones.

### Variables de entorno (todas opcionales en desarrollo)

| Variable | Para qué sirve | Ejemplo |
|---|---|---|
| `PUERTO` | Puerto del servidor (por defecto 3000) | `3000` |
| `SESSION_SECRET` | Firma las cookies de sesión. **Obligatoria con `NODE_ENV=production`**; en desarrollo se usa un valor de ejemplo | `una-frase-larga-y-secreta` |
| `NODE_ENV` | Con `production` la cookie viaja solo por HTTPS y se exige `SESSION_SECRET` | `production` |
| `BASE_DE_DATOS` | Ruta de otra base SQLite (la usan las pruebas para no tocar la real) | `C:\temp\prueba.db` |

En PowerShell se ponen antes de arrancar: `$env:SESSION_SECRET = "una-frase-larga-y-secreta"; npm start`. No hay archivo `.env`: el proyecto no lo lee.

## Qué hace

**Visitante y cliente:** catálogo con búsqueda, géneros (varios a la vez: sirve cualquiera), formato, "solo ofertas", orden y "Ver más" de 20 en 20; detalle del álbum con los tres formatos, canciones y reseñas; página de artista; mapa de la tienda; carrito; compra con envío a domicilio (tarifa por código postal) o recoger en tienda; pago con tarjeta (simulado) o en tienda con un código; reseñas con media estrella; **solicitar** un disco que no encuentra ("¿No encuentras el formato que buscas? Solicítalo"); **Mi cuenta** con sus pedidos y el cambio de datos y contraseña.

**Administrador:** cuatro cifras del mes (ventas, pedidos, por preparar, sin pagar) y tres reportes (más vendidos del mes, más solicitados y stock bajo); lista de pedidos con cambio de estado (solo hacia adelante o cancelar; cancelar devuelve las existencias); confirmar pagos en caja con el código; alta, edición y ocultamiento de álbumes, con precio, existencias y **descuento en porcentaje para cada formato**.

**Es simulado:** el pago con tarjeta (se valida el formato, no se cobra y solo se guardan la marca y los últimos 4 dígitos), el envío (tarifa fija por código postal, sin paquetería), los precios y existencias de ejemplo y los datos de `--demo`. Las portadas se descargan del servidor de imágenes de Deezer y el mapa viene de OpenStreetMap con Leaflet.

## Estructura (MVC)

```
Backend/
  server.js            arranca Express, sesiones y rutas
  base-de-datos.js     abre SQLite y crea las tablas desde schema.sql
  schema.sql           10 tablas
  modelos/             consultas y reglas de negocio (el "M"); tarjeta.js valida el pago simulado
  controladores/       reciben la petición y responden (el "C")
  rutas/               qué URL llama a qué controlador
  middlewares/         sesión, permisos y seguridad
  scripts/             sembrar.js (carga inicial) y crear-admin.js
  datos/catalogo.json  catálogo inicial
  pruebas/             pruebas automáticas de la API
Frontend/              12 páginas HTML, CSS/estilos.css y JS/ (el "V")
```

Cada página del frontend carga, en este orden: `comun.js` (utilidades), `encabezado.js` (menú y pie, iguales en todas las páginas) y su propio archivo JS. `login.html` no lleva encabezado.

## Flujos para leer el código

1. **Catálogo:** `catalogo.js` → `album.rutas.js` → `album.controlador.js` → `album.modelo.js`
2. **Iniciar sesión:** `login.js` → `autenticacion.*` → `usuario.modelo.js` (hash con bcrypt, sesión, límite de intentos en `seguridad.js`)
3. **Comprar:** `carrito.js` → `pago.js` → `pedido.*` → `pedido.modelo.js` (cotizar, validar, transacción que descuenta existencias) y `tarjeta.js`
4. **Administrar pedidos:** `admin.js` → `admin.*` → `pedido-admin.modelo.js` (reglas de estados)
5. **Administrar álbumes y descuentos:** `album-form.js` → `admin.*` → `catalogo-admin.modelo.js`; el precio con descuento se calcula en `album.modelo.js` (`precioFinal`)
6. **Solicitar un disco:** `detalle-album.js` → `album.rutas.js` → `solicitud.controlador.js` → `solicitud.modelo.js` (los "más solicitados" salen en el resumen del panel)

## Cómo comprobar los flujos principales

1. **Catálogo:** elige dos géneros, un formato y "Solo ofertas"; la dirección cambia y "Ver más" carga 20 más.
2. **Compra con tarjeta:** abre un álbum, agrégalo al carrito, crea una cuenta, paga con "Recoger en tienda" y la tarjeta de prueba `4242 4242 4242 4242` (vencimiento futuro, CVV de 3 dígitos). El pedido nace pagado y aparece en Mi cuenta.
3. **Pago en tienda:** repite la compra eligiendo "Pago en tienda" y copia el código `DIS-…`. Entra como administrador, escríbelo en "Confirmar pago en tienda" y luego avanza el estado del pedido.
4. **Cancelar:** cancela un pedido desde el panel y revisa que las existencias del álbum regresen.
5. **Descuento:** en Álbumes → Editar, pon 20 en "Descuento %" de un formato y guarda; el detalle mostrará el precio rebajado y el álbum saldrá con "Solo ofertas".
6. **Privacidad:** con otra cuenta de cliente abre `pedido.html?id=` de un pedido ajeno: dice que no existe.
